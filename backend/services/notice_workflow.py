from sqlalchemy.orm import Session

from agents.notice_agent import process_new_notice
from services.embedding_service import create_embedding
from services.notification_service import route_notice_to_students
from models import Notice

import uuid


def process_notice_workflow(
    db: Session,
    raw_text: str,
    document_url: str = None,
):
    """
    Complete notice-processing workflow.

    RAW TEXT
      ↓
    Strands notice agent
      ↓
    Structured notice metadata
      ↓
    Notice embedding
      ↓
    PostgreSQL
      ↓
    Student routing
      ↓
    Notifications
    """

    if not raw_text or not raw_text.strip():
        raise ValueError("Notice text cannot be empty.")

    # --------------------------------------------------
    # 1. AI processing
    # --------------------------------------------------

    structured_data = process_new_notice(raw_text)

    notice_data = structured_data.model_dump()

    # --------------------------------------------------
    # 2. Normalize registration link
    # --------------------------------------------------

    registration_link = notice_data.get("registration_link")

    if not registration_link or registration_link in [
        "None Provided",
        "None",
        "null",
        "",
        "example.com",
        "https://example.com",
        "http://example.com",
    ]:
        registration_link = None

    # --------------------------------------------------
    # 3. Create notice embedding
    # --------------------------------------------------

    notice_embedding_text = f"""
        Title: {notice_data["title"]}
        Category: {notice_data["category"]}
        Summary: {notice_data["summary"]}
        Required action: {notice_data["required_action"]}
        Eligibility: {notice_data["eligibility"]}
        Original notice:
        {raw_text}
    """

    notice_embedding = create_embedding(notice_embedding_text)

    # --------------------------------------------------
    # 4. Create database record
    # --------------------------------------------------

    notice = Notice(
        id=str(uuid.uuid4()),
        title=notice_data["title"],
        category=notice_data["category"],
        is_mandatory=notice_data["is_mandatory"],
        eligibility=notice_data["eligibility"],
        deadline=(
            notice_data["deadline"].isoformat() if notice_data.get("deadline") else None
        ),
        registration_link=registration_link,
        required_action=notice_data["required_action"],
        importance=notice_data["importance"],
        summary=notice_data["summary"],
        raw_text=raw_text,
        notice_embedding=notice_embedding,
        pdf_url=document_url,
    )

    db.add(notice)
    db.commit()
    db.refresh(notice)

    # --------------------------------------------------
    # 5. Deterministic routing
    # --------------------------------------------------

    notifications, routing_report = route_notice_to_students(db, notice)

    return notice, notifications, routing_report
