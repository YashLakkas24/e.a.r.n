from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Student
from auth_dependencies import require_student

from services.embedding_service import create_preference_embedding
from services.notification_service import refresh_student_notifications

router = APIRouter(
    prefix="/api/students",
    tags=["Students"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# REQUEST SCHEMA
# ============================================================


class StudentPreferencesRequest(BaseModel):
    preferences: str = Field(
        default="",
        max_length=2000,
    )


# ============================================================
# STUDENT PROFILE
# ============================================================


@router.get("/{student_id}")
def get_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    if student.firebase_uid != current_user.get("uid"):
        raise HTTPException(
            status_code=403,
            detail="You can only access your own student profile",
        )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    return {
        "student_id": student.student_id,
        "name": student.name,
        "roll_number": student.roll_number,
        "year": student.year,
        "branch": student.branch,
        "attendance": student.attendance,
        "previous_sem_cgpa": student.previous_sem_cgpa,
        "extracurricular_count": student.extracurricular_count,
    }


# ============================================================
# NOTICE PREFERENCES
# ============================================================


@router.get("/{student_id}/preferences")
def get_student_preferences(
    student_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    if student.firebase_uid != current_user.get("uid"):
        raise HTTPException(
            status_code=403,
            detail="You can only access your own student profile",
        )
    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    preferences = student.preferences or ""

    return {
        "student_id": student.student_id,
        "preferences": preferences,
        "has_preferences": bool(preferences.strip()),
    }


@router.put("/{student_id}/preferences")
def update_student_preferences(
    student_id: str,
    body: StudentPreferencesRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    if student.firebase_uid != current_user.get("uid"):
        raise HTTPException(
            status_code=403,
            detail="You can only access your own student profile",
        )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    preferences = body.preferences.strip()

    # --------------------------------------------------------
    # Empty preferences
    # --------------------------------------------------------

    if not preferences:

        student.preferences = ""
        student.preference_embedding = None

    else:

        # ----------------------------------------------------
        # Generate embedding from explicitly written preferences
        # ----------------------------------------------------

        try:

            embedding = create_preference_embedding(preferences)

        except Exception as e:

            db.rollback()

            print(f"Preference embedding failed for " f"{student_id}: {e}")

            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to process your notice preferences "
                    "right now. Please try again."
                ),
            )

        student.preferences = preferences
        student.preference_embedding = embedding

    # --------------------------------------------------------
    # Save preference profile
    # --------------------------------------------------------

    db.commit()
    db.refresh(student)

    # --------------------------------------------------------
    # Re-evaluate existing notices
    # --------------------------------------------------------

    try:

        refresh_student_notifications(
            student=student,
            db=db,
        )

    except Exception as e:

        print(f"Notification refresh failed for " f"{student_id}: {e}")

    return {
        "message": "Notice preferences updated successfully.",
        "student_id": student.student_id,
        "preferences": student.preferences,
        "has_preferences": bool((student.preferences or "").strip()),
    }
