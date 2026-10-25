import asyncio
import os
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

import pytesseract
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from PIL import Image
from pypdf import PdfReader
from sqlalchemy.orm import Session

from auth_dependencies import require_student, require_teacher
from database import SessionLocal
from models import Notice, Notification
from services.notice_workflow import process_notice_workflow
from services.storage_service import (
    download_notice_file,
    upload_notice_file,
)

router = APIRouter(tags=["Notices"])

POPPLER_PATH = os.getenv("POPPLER_PATH")
TESSERACT_PATH = os.getenv("TESSERACT_PATH")

if TESSERACT_PATH:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
}

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_BATCH_FILES = 20

# Keep this bounded.
# We don't want 20 OCR + AI + DB operations running simultaneously.
BATCH_CONCURRENCY = 4


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# TEXT / FILE EXTRACTION
# ============================================================


def extract_notice_text(
    file_bytes: bytes,
    filename: str,
    content_type: str | None,
) -> str:
    extension = Path(filename).suffix.lower()

    # --------------------------------------------------------
    # PDF
    # --------------------------------------------------------

    if extension == ".pdf" or content_type == "application/pdf":
        reader = PdfReader(BytesIO(file_bytes))

        extracted_text = ""

        for page in reader.pages:
            page_text = page.extract_text()

            if page_text:
                extracted_text += page_text + "\n"

        # OCR fallback for scanned PDFs
        if not extracted_text.strip():
            from pdf2image import convert_from_bytes

            images = convert_from_bytes(
                file_bytes,
                poppler_path=POPPLER_PATH or None,
            )

            ocr_text = []

            for image in images:
                text = pytesseract.image_to_string(image)

                if text.strip():
                    ocr_text.append(text)

            extracted_text = "\n".join(ocr_text)

        return extracted_text.strip()

    # --------------------------------------------------------
    # IMAGE
    # --------------------------------------------------------

    if content_type in ALLOWED_IMAGE_TYPES or extension in {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }:
        image = Image.open(BytesIO(file_bytes))

        extracted_text = pytesseract.image_to_string(image)

        return extracted_text.strip()

    raise ValueError(
        "Unsupported file type. " "Only PDF, JPG, JPEG, PNG and WEBP are supported."
    )


# ============================================================
# SYNCHRONOUS NOTICE PROCESSOR
# ============================================================


def process_notice_sync(
    *,
    storage_path: str | None = None,
    document_url: str | None = None,
    raw_text: str | None = None,
    filename: str = "",
    content_type: str | None = None,
):
    """
    One complete notice-processing job.

    This function is intentionally synchronous because:
    - PDF parsing is synchronous
    - OCR is synchronous
    - existing AI workflow is synchronous
    - current SQLAlchemy session is synchronous

    It is executed inside asyncio.to_thread().
    """

    db = SessionLocal()

    try:
        # ----------------------------------------------------
        # File-based notice
        # ----------------------------------------------------

        if storage_path:
            file_bytes = download_notice_file(storage_path)

            raw_text = extract_notice_text(
                file_bytes=file_bytes,
                filename=filename,
                content_type=content_type,
            )

        if not raw_text or not raw_text.strip():
            raise ValueError(
                f"Could not extract readable text from {filename or 'notice'}."
            )

        notice, notifications, routing_report = process_notice_workflow(
            db=db,
            raw_text=raw_text,
            document_url=document_url,
        )

        print(f"Notice processed: {notice.title}")
        print(f"Routing report: {routing_report}")

        return {
            "notice_id": notice.id,
            "title": notice.title,
            "routing_report": routing_report,
        }

    except Exception as e:
        db.rollback()

        print(f"Notice processing failed " f"for {filename or 'text notice'}: {e}")

        raise

    finally:
        db.close()


# ============================================================
# ASYNC WRAPPER
# ============================================================


async def process_notice_in_background(
    *,
    storage_path: str | None = None,
    document_url: str | None = None,
    raw_text: str | None = None,
    filename: str = "",
    content_type: str | None = None,
):
    """
    Async wrapper around the synchronous processing pipeline.
    """

    return await asyncio.to_thread(
        process_notice_sync,
        storage_path=storage_path,
        document_url=document_url,
        raw_text=raw_text,
        filename=filename,
        content_type=content_type,
    )


# ============================================================
# BATCH PROCESSOR
# ============================================================


async def process_batch_in_background(items: list[dict]):
    """
    Process multiple notices concurrently.

    Concurrency is bounded to BATCH_CONCURRENCY.
    """

    semaphore = asyncio.Semaphore(BATCH_CONCURRENCY)

    async def process_one(item: dict):
        async with semaphore:
            try:
                result = await process_notice_in_background(
                    storage_path=item["storage_path"],
                    document_url=item["document_url"],
                    filename=item["filename"],
                    content_type=item["content_type"],
                )

                print(f"Batch notice completed: " f"{item['filename']}")

                return {
                    "filename": item["filename"],
                    "status": "processed",
                    "notice_id": result["notice_id"],
                }

            except Exception as e:
                print(f"Batch notice failed: " f"{item['filename']}: {e}")

                return {
                    "filename": item["filename"],
                    "status": "failed",
                    "error": str(e),
                }

    results = await asyncio.gather(
        *(process_one(item) for item in items),
        return_exceptions=False,
    )

    print(f"Batch processing completed: " f"{len(results)} notices.")

    return results


# ============================================================
# ASYNC STORAGE UPLOAD
# ============================================================


async def upload_notice_file_async(
    *,
    file_bytes: bytes,
    storage_path: str,
    content_type: str,
) -> str:
    """
    Move synchronous Supabase Storage upload
    out of the FastAPI event loop.
    """

    return await asyncio.to_thread(
        upload_notice_file,
        file_bytes=file_bytes,
        storage_path=storage_path,
        content_type=content_type,
    )


# ============================================================
# FILE METADATA NORMALIZATION
# ============================================================


def normalize_content_type(
    filename: str,
    content_type: str | None,
) -> str:
    extension = Path(filename).suffix.lower()

    if extension == ".pdf":
        return "application/pdf"

    if extension in {".jpg", ".jpeg"}:
        return "image/jpeg"

    if extension == ".png":
        return "image/png"

    if extension == ".webp":
        return "image/webp"

    if content_type:
        return content_type

    raise ValueError("Unable to determine file type.")


# ============================================================
# TEXT NOTICE
# ============================================================


@router.post("/api/admin/notice/text")
async def upload_text_notice(
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    current_user: dict = Depends(require_teacher),
):
    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Notice text cannot be empty.",
        )

    background_tasks.add_task(
        process_notice_in_background,
        raw_text=text,
    )

    return {"message": "Notice accepted for background processing."}


# ============================================================
# SINGLE PDF NOTICE
# ============================================================


@router.post("/api/admin/notice/pdf")
async def upload_pdf_notice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_teacher),
):
    filename = file.filename or "notice.pdf"

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    try:
        file_bytes = await file.read()

        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="PDF file is empty.",
            )

        storage_path = f"notices/{uuid.uuid4()}.pdf"

        document_url = await upload_notice_file_async(
            file_bytes=file_bytes,
            storage_path=storage_path,
            content_type="application/pdf",
        )

        background_tasks.add_task(
            process_notice_in_background,
            storage_path=storage_path,
            document_url=document_url,
            filename=filename,
            content_type="application/pdf",
        )

        return {
            "message": "PDF accepted for background processing.",
            "document_url": document_url,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF upload failed: {str(e)}",
        )


# ============================================================
# SINGLE IMAGE NOTICE
# ============================================================


@router.post("/api/admin/notice/image")
async def upload_image_notice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_teacher),
):
    filename = file.filename or "notice-image"

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, JPEG and WEBP images are supported.",
        )

    try:
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Image file is empty.",
            )

        extension = Path(filename).suffix.lower()

        if extension not in {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        }:
            raise HTTPException(
                status_code=400,
                detail="Unsupported image extension.",
            )

        content_type = normalize_content_type(
            filename,
            file.content_type,
        )

        storage_path = f"notices/{uuid.uuid4()}{extension}"

        document_url = await upload_notice_file_async(
            file_bytes=image_bytes,
            storage_path=storage_path,
            content_type=content_type,
        )

        background_tasks.add_task(
            process_notice_in_background,
            storage_path=storage_path,
            document_url=document_url,
            filename=filename,
            content_type=content_type,
        )

        return {
            "message": "Image accepted for background processing.",
            "document_url": document_url,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image upload failed: {str(e)}",
        )


# ============================================================
# BATCH NOTICE UPLOAD
# ============================================================


async def prepare_batch_file(
    file: UploadFile,
) -> dict:
    """
    Read and upload one file asynchronously.

    Blocking Supabase upload is moved to a thread.
    """

    filename = file.filename or "unnamed-file"

    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type. " "Use PDF, JPG, JPEG, PNG or WEBP.")

    file_bytes = await file.read()

    if not file_bytes:
        raise ValueError("File is empty.")

    content_type = normalize_content_type(
        filename,
        file.content_type,
    )

    storage_path = f"notices/{uuid.uuid4()}{extension}"

    document_url = await upload_notice_file_async(
        file_bytes=file_bytes,
        storage_path=storage_path,
        content_type=content_type,
    )

    return {
        "filename": filename,
        "storage_path": storage_path,
        "document_url": document_url,
        "content_type": content_type,
    }


@router.post("/api/admin/notices/batch")
async def upload_batch_notices(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(require_teacher),
):
    if not files:
        raise HTTPException(
            status_code=400,
            detail="Please select at least one notice file.",
        )

    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"You can upload a maximum of " f"{MAX_BATCH_FILES} notices at once."
            ),
        )

    # --------------------------------------------------------
    # Upload all files concurrently
    # --------------------------------------------------------

    upload_results = await asyncio.gather(
        *(prepare_batch_file(file) for file in files),
        return_exceptions=True,
    )

    accepted = []
    results = []

    for file, result in zip(files, upload_results):
        filename = file.filename or "unnamed-file"

        if isinstance(result, Exception):
            results.append(
                {
                    "filename": filename,
                    "status": "failed",
                    "error": str(result),
                }
            )
            continue

        accepted.append(result)

        results.append(
            {
                "filename": result["filename"],
                "status": "accepted",
                "document_url": result["document_url"],
            }
        )

    # --------------------------------------------------------
    # Start all notice processing concurrently
    # --------------------------------------------------------

    if accepted:
        background_tasks.add_task(
            process_batch_in_background,
            accepted,
        )

    accepted_count = len(accepted)
    failed_count = len(results) - accepted_count

    return {
        "message": "Batch notice upload accepted.",
        "total": len(results),
        "accepted": accepted_count,
        "failed": failed_count,
        "processing": accepted_count > 0,
        "results": results,
    }


# ============================================================
# ALL NOTICES — TEACHER
# ============================================================


@router.get("/api/notices")
def get_all_notices(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    notices = db.query(Notice).order_by(Notice.created_at.desc()).all()

    return {
        "total": len(notices),
        "notices": [
            {
                "id": notice.id,
                "title": notice.title,
                "summary": notice.summary,
                "category": notice.category,
                "is_mandatory": notice.is_mandatory,
                "eligibility": notice.eligibility,
                "deadline": notice.deadline,
                "registration_link": notice.registration_link,
                "required_action": notice.required_action,
                "document_url": notice.pdf_url,
                "pdf_url": notice.pdf_url,
                "importance": notice.importance,
                "created_at": notice.created_at,
            }
            for notice in notices
        ],
    }


# ============================================================
# STUDENT PERSONALIZED FEED
# ============================================================


@router.get("/api/student/{student_id}/notifications")
def get_notifications(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):
    if current_user.get("uid") != student_id:
        raise HTTPException(
            status_code=403,
            detail="You can only access your own notifications.",
        )

    notifications = (
        db.query(Notification)
        .filter(Notification.student_id == student_id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    result = []

    for notification in notifications:
        notice = db.query(Notice).filter(Notice.id == notification.notice_id).first()

        if not notice:
            continue

        result.append(
            {
                "notification_id": notification.id,
                "notice_id": notice.id,
                "title": notice.title,
                "summary": notice.summary,
                "document_url": notice.pdf_url,
                "pdf_url": notice.pdf_url,
                "category": notice.category,
                "deadline": notice.deadline,
                "registration_link": notice.registration_link,
                "required_action": notice.required_action,
                "priority": notification.priority,
                "urgency": notification.urgency,
                "days_left": notification.days_left,
                "relevance_score": notification.relevance_score,
                "reason": notification.reason,
                "status": notification.status,
                "created_at": notification.created_at,
            }
        )

    return {
        "student_id": student_id,
        "total": len(result),
        "notifications": result,
    }


# ============================================================
# STUDENT ALL NOTICES
# ============================================================


@router.get("/api/student/{student_id}/notices")
def get_student_all_notices(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):
    if current_user.get("uid") != student_id:
        raise HTTPException(
            status_code=403,
            detail="You can only access your own notices.",
        )

    notices = db.query(Notice).order_by(Notice.created_at.desc()).all()

    student_notifications = {
        notification.notice_id: notification
        for notification in (
            db.query(Notification).filter(Notification.student_id == student_id).all()
        )
    }

    result = []

    for notice in notices:
        notification = student_notifications.get(notice.id)

        result.append(
            {
                "notice_id": notice.id,
                "title": notice.title,
                "summary": notice.summary,
                "document_url": notice.pdf_url,
                "pdf_url": notice.pdf_url,
                "category": notice.category,
                "is_mandatory": notice.is_mandatory,
                "eligibility": notice.eligibility,
                "deadline": notice.deadline,
                "registration_link": notice.registration_link,
                "required_action": notice.required_action,
                "importance": notice.importance,
                "priority": (notification.priority if notification else None),
                "urgency": (notification.urgency if notification else None),
                "days_left": (notification.days_left if notification else None),
                "relevance_score": (
                    notification.relevance_score if notification else None
                ),
                "reason": (notification.reason if notification else None),
                "status": (notification.status if notification else "NOT_RELEVANT"),
                "created_at": notice.created_at,
            }
        )

    return {
        "student_id": student_id,
        "total": len(result),
        "notices": result,
    }


# ============================================================
# MARK NOTIFICATION READ
# ============================================================


@router.patch("/api/student/{student_id}/notifications/{notification_id}/read")
def mark_notification_read(
    student_id: str,
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):
    if current_user.get("uid") != student_id:
        raise HTTPException(
            status_code=403,
            detail="You can only modify your own notifications.",
        )

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.student_id == student_id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    notification.status = "READ"
    notification.read_at = datetime.utcnow()

    db.commit()

    return {"message": "Notification marked as read."}
