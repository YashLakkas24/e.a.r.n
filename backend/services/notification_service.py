import uuid

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models import Student, Notice, Notification

from services.decision_engine import evaluate_student_for_notice


def route_notice_to_students(
    db: Session,
    notice: Notice,
):

    students = db.query(Student).all()

    created = []

    # Routing metrics
    students_evaluated = 0
    eligible_count = 0
    not_eligible_count = 0
    highly_relevant_count = 0
    medium_relevant_count = 0
    suppressed_count = 0
    mandatory_count = 0

    for student_record in students:

        students_evaluated += 1
        # Convert SQLAlchemy model -> dictionary
        student = {
            "id": student_record.student_id,
            "name": student_record.name,
            "year": student_record.year,
            "branch": student_record.branch,
            "preferences": student_record.preferences or "",
            "preference_embedding": student_record.preference_embedding,
            # compatibility
            "interests": student_record.interests or [],
            "interest_embedding": student_record.interest_embedding,
        }

        notice_data = {
            "id": notice.id,
            "title": notice.title,
            "category": notice.category,
            "is_mandatory": notice.is_mandatory,
            "eligibility": notice.eligibility or {},
            "deadline": notice.deadline,
            "registration_link": notice.registration_link,
            "required_action": notice.required_action,
            "importance": notice.importance,
            "summary": notice.summary,
            "notice_embedding": notice.notice_embedding,
        }

        evaluation = evaluate_student_for_notice(
            student,
            notice_data,
        )

        # ------------------------------------------
        # Routing metrics
        # ------------------------------------------

        if evaluation["eligible"]:
            eligible_count += 1
        else:
            not_eligible_count += 1

        if evaluation["relevance_level"] == "HIGH":
            highly_relevant_count += 1

        elif evaluation["relevance_level"] == "MEDIUM":
            medium_relevant_count += 1

        if evaluation["routing"] == "SUPPRESS":
            suppressed_count += 1
            continue

        if evaluation["routing"] == "MUST_NOTIFY":
            mandatory_count += 1

        # ------------------------------------------
        # Prevent duplicate notifications
        # ------------------------------------------

        existing = (
            db.query(Notification)
            .filter(
                Notification.student_id == student["id"],
                Notification.notice_id == notice.id,
            )
            .first()
        )

        if existing:
            continue

        try:
            with db.begin_nested():
                notification = Notification(
                    id=str(uuid.uuid4()),
                    student_id=student["id"],
                    notice_id=notice.id,
                    relevance_score=evaluation["relevance_score"],
                    priority=evaluation["priority"],
                    urgency=evaluation["urgency"],
                    days_left=evaluation["days_left"],
                    reason=evaluation["reason"],
                    status="UNREAD",
                )

                db.add(notification)
                db.flush()

            created.append(notification)

        except IntegrityError:
            continue

    db.commit()

    # ------------------------------------------
    # Routing report
    # ------------------------------------------

    routing_report = {
        "students_evaluated": students_evaluated,
        "eligible": eligible_count,
        "not_eligible": not_eligible_count,
        "highly_relevant": highly_relevant_count,
        "medium_relevant": medium_relevant_count,
        "suppressed": suppressed_count,
        "mandatory": mandatory_count,
        "notifications_created": len(created),
    }

    return created, routing_report


def refresh_student_notifications(
    db: Session,
    student: Student,
):
    """
    Recalculate one student's notifications
    against all existing notices.
    """

    notices = db.query(Notice).all()

    student_data = {
        "id": student.student_id,
        "name": student.name,
        "year": student.year,
        "branch": student.branch,
        "preferences": student.preferences or "",
        "preference_embedding": student.preference_embedding,
        # compatibility only
        "interests": student.interests or [],
        "interest_embedding": student.interest_embedding,
    }

    for notice in notices:
        notice_data = {
            "id": notice.id,
            "title": notice.title,
            "category": notice.category,
            "is_mandatory": notice.is_mandatory,
            "eligibility": notice.eligibility or {},
            "deadline": notice.deadline,
            "registration_link": notice.registration_link,
            "required_action": notice.required_action,
            "importance": notice.importance,
            "summary": notice.summary,
            "notice_embedding": notice.notice_embedding,
        }

        evaluation = evaluate_student_for_notice(
            student_data,
            notice_data,
        )

        existing = (
            db.query(Notification)
            .filter(
                Notification.student_id == student.student_id,
                Notification.notice_id == notice.id,
            )
            .first()
        )

        should_notify = evaluation["routing"] in {"NOTIFY", "MUST_NOTIFY"}

        # Relevant now → create/update
        if should_notify and existing:
            existing.relevance_score = evaluation["relevance_score"]
            existing.priority = evaluation["priority"]
            existing.urgency = evaluation["urgency"]
            existing.days_left = evaluation["days_left"]
            existing.reason = evaluation["reason"]

        elif should_notify and not existing:

            try:
                with db.begin_nested():
                    db.add(
                        Notification(
                            id=str(uuid.uuid4()),
                            student_id=student.student_id,
                            notice_id=notice.id,
                            relevance_score=evaluation["relevance_score"],
                            priority=evaluation["priority"],
                            urgency=evaluation["urgency"],
                            days_left=evaluation["days_left"],
                            reason=evaluation["reason"],
                            status="UNREAD",
                        )
                    )

                    db.flush()

            except IntegrityError:
                # Another concurrent operation already created
                # this student's notification for the same notice.
                continue

            # No longer relevant → remove from personalized feed
        elif not should_notify and existing:

            db.delete(existing)

    db.commit()
