import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import SessionLocal

from models import (
    Student,
    StudentInterest,
    QuizAnswer,
    InterestAnalysis,
    CareerPivotAnalysis,
)

from auth_dependencies import require_student

from ai_student.llm.service import generate_next_question
from ai_student.quiz.question_engine import validate_question
from ai_student.interest_analysis.analyzer import analyze_interest
from ai_student.career_pivot.pipeline import (
    discover_career_directions,
    analyze_selected_direction,
)
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/students", tags=["Interest+"])


# ============================================================
# DATABASE DEPENDENCY
# ============================================================


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# STUDENT ACCESS CHECK
# ============================================================


def verify_student_access(student_id: str, current_user: dict):
    """
    Make sure the Firebase-authenticated student can access
    only their own student data.
    """

    authenticated_student_id = current_user.get("uid")

    if authenticated_student_id != student_id:
        raise HTTPException(
            status_code=403, detail="You can only access your own student data"
        )


# ============================================================
# REQUEST SCHEMAS
# ============================================================


class InterestRequest(BaseModel):
    interest: str


class AnswerRequest(BaseModel):
    interest: str
    question_id: str
    question: str
    answer: Any
    question_order: int


class CareerDirectionAnalyzeRequest(BaseModel):
    direction: str
    force_refresh: bool = False


# ============================================================
# CHECK INTEREST+ STATUS
# ============================================================


@router.get("/{student_id}/interests/status")
def get_interest_status(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    interests = (
        db.query(StudentInterest).filter(StudentInterest.student_id == student_id).all()
    )

    if not interests:
        return {"student_id": student_id, "completed": False, "interests": []}

    return {
        "student_id": student_id,
        "completed": True,
        "interests": [
            {"interest": interest.interest, "status": interest.status}
            for interest in interests
        ],
    }


# ============================================================
# SAVE NEW INTEREST
# ============================================================


@router.post("/{student_id}/interests")
def add_interest(
    student_id: str,
    interest_data: InterestRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    # Check student exists
    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check whether this interest already exists
    existing_interest = (
        db.query(StudentInterest)
        .filter(
            StudentInterest.student_id == student_id,
            StudentInterest.interest == interest_data.interest,
        )
        .first()
    )

    if existing_interest:
        return {
            "message": "Interest already exists",
            "student_id": student_id,
            "interest": existing_interest.interest,
            "status": existing_interest.status,
        }

    new_interest = StudentInterest(
        student_id=student_id,
        interest=interest_data.interest,
        status="active",
    )

    db.add(new_interest)
    db.commit()
    db.refresh(new_interest)

    return {
        "message": "Interest saved successfully",
        "student_id": student_id,
        "interest": new_interest.interest,
        "status": new_interest.status,
    }


# ============================================================
# START INTEREST+ SESSION
# ============================================================


@router.post("/{student_id}/interest-session/start")
def start_interest_session(
    student_id: str,
    interest_data: InterestRequest,
    reset: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    # --------------------------------------------------------
    # 1. Check whether student exists
    # --------------------------------------------------------

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # --------------------------------------------------------
    # 2. Reset previous answers if requested
    # --------------------------------------------------------

    if reset:
        db.query(QuizAnswer).filter(
            QuizAnswer.student_id == student_id,
            QuizAnswer.interest == interest_data.interest,
        ).delete()

        db.commit()

    # --------------------------------------------------------
    # 3. Ensure student interest record exists
    # --------------------------------------------------------

    existing_interest = (
        db.query(StudentInterest)
        .filter(
            StudentInterest.student_id == student_id,
            StudentInterest.interest == interest_data.interest,
        )
        .first()
    )

    if not existing_interest:
        new_interest = StudentInterest(
            student_id=student_id, interest=interest_data.interest, status="active"
        )

        db.add(new_interest)
        db.commit()

    # --------------------------------------------------------
    # 4. Get previous answers for this interest
    # --------------------------------------------------------

    previous_answers = (
        db.query(QuizAnswer)
        .filter(
            QuizAnswer.student_id == student_id,
            QuizAnswer.interest == interest_data.interest,
        )
        .order_by(QuizAnswer.question_order)
        .all()
    )

    # --------------------------------------------------------
    # 5. Build conversation for the AI safely
    # --------------------------------------------------------

    conversation = []

    for answer in previous_answers:
        try:
            parsed_answer = json.loads(answer.answer)
        except (json.JSONDecodeError, TypeError):
            parsed_answer = answer.answer

        conversation.append(
            {
                "question_id": answer.question_id,
                "question": answer.question,
                "answer": parsed_answer,
            }
        )

    # --------------------------------------------------------
    # 6. Ask AI for the next question
    # --------------------------------------------------------

    question = generate_next_question(
        interest=interest_data.interest,
        conversation=conversation,
        existing_skills=[],
        previous_interests=[],
    )

    # --------------------------------------------------------
    # 7. AI says assessment is complete
    # --------------------------------------------------------

    if question is None:
        return {
            "completed": True,
            "question_number": len(conversation),
            "total_questions": 5,
            "next_question": None,
        }

    # --------------------------------------------------------
    # 8. Validate AI-generated question
    # --------------------------------------------------------

    question = validate_question(question)

    return {
        "completed": False,
        "question_number": len(conversation) + 1,
        "total_questions": 5,
        "next_question": question.model_dump(),
    }


# ============================================================
# SUBMIT ANSWER + GENERATE NEXT QUESTION
# ============================================================


@router.post("/{student_id}/interest-session/answer")
def submit_interest_answer(
    student_id: str,
    answer_data: AnswerRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    # --------------------------------------------------------
    # 1. Check student
    # --------------------------------------------------------

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # --------------------------------------------------------
    # 2. Save answer
    # --------------------------------------------------------

    new_answer = QuizAnswer(
        student_id=student_id,
        interest=answer_data.interest,
        question_id=answer_data.question_id,
        question=answer_data.question,
        answer=json.dumps(answer_data.answer),
        question_order=answer_data.question_order,
    )

    db.add(new_answer)
    db.commit()
    db.refresh(new_answer)

    # --------------------------------------------------------
    # 3. Get ALL answers for this interest
    # --------------------------------------------------------

    previous_answers = (
        db.query(QuizAnswer)
        .filter(
            QuizAnswer.student_id == student_id,
            QuizAnswer.interest == answer_data.interest,
        )
        .order_by(QuizAnswer.question_order)
        .all()
    )

    question_count = len(previous_answers)

    # --------------------------------------------------------
    # 4. Build conversation
    # --------------------------------------------------------

    conversation = []

    for answer in previous_answers:

        try:
            parsed_answer = json.loads(answer.answer)
        except (json.JSONDecodeError, TypeError):
            parsed_answer = answer.answer

        conversation.append(
            {
                "question_id": answer.question_id,
                "question": answer.question,
                "answer": parsed_answer,
            }
        )

    # ========================================================
    # 5. EXACTLY 5 QUESTIONS → FINAL ANALYSIS
    # ========================================================

    if question_count >= 5:

        analysis_result = analyze_interest(
            interest=answer_data.interest,
            answers=conversation,
            existing_skills=[],
            previous_interests=[],
        )

        # ----------------------------------------------------
        # Save analysis
        # ----------------------------------------------------

        analysis_record = InterestAnalysis(
            student_id=student_id,
            interest=analysis_result.interest,
            interest_score=analysis_result.interest_score,
            confidence_score=analysis_result.confidence_score,
            experience_score=analysis_result.experience_score,
            capability_score=analysis_result.capability_score,
            strengths=json.dumps(analysis_result.strengths),
            skill_gaps=json.dumps(analysis_result.skill_gaps),
            potential_directions=json.dumps(analysis_result.potential_directions),
            next_steps=json.dumps(analysis_result.next_steps),
            evidence=json.dumps(analysis_result.evidence),
            summary=analysis_result.summary,
        )

        db.add(analysis_record)
        db.commit()
        db.refresh(analysis_record)

        # ----------------------------------------------------
        # Return final analysis
        # ----------------------------------------------------

        return {
            "completed": True,
            "question_number": 5,
            "total_questions": 5,
            "next_question": None,
            "message": "Interest+ assessment completed.",
            "analysis": analysis_result.model_dump(),
        }

    # ========================================================
    # 6. LESS THAN 5 QUESTIONS → GET NEXT QUESTION
    # ========================================================

    next_question = generate_next_question(
        interest=answer_data.interest,
        conversation=conversation,
        existing_skills=[],
        previous_interests=[],
    )

    # --------------------------------------------------------
    # Safety check
    # --------------------------------------------------------

    if next_question is None:

        raise HTTPException(
            status_code=500,
            detail=(
                f"AI attempted to finish the assessment after "
                f"{question_count} questions. "
                f"The assessment requires 5 questions."
            ),
        )

    # --------------------------------------------------------
    # Validate question
    # --------------------------------------------------------

    next_question = validate_question(next_question)

    return {
        "completed": False,
        "question_number": question_count + 1,
        "total_questions": 5,
        "next_question": next_question.model_dump(),
        "result": None,
    }


# ============================================================
# JSON PARSING HELPER
# ============================================================


def parse_json_safely(val):
    if not val:
        return None

    try:
        return json.loads(val)
    except Exception:
        return val


# ============================================================
# GET INTEREST ANALYSIS
# ============================================================


@router.get("/{student_id}/interest-analysis")
def get_interest_analysis(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    # --------------------------------------------------------
    # 1. Check whether student exists
    # --------------------------------------------------------

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # --------------------------------------------------------
    # 2. Get all interest analyses for this student
    # --------------------------------------------------------

    analyses = (
        db.query(InterestAnalysis)
        .filter(InterestAnalysis.student_id == student_id)
        .order_by(InterestAnalysis.id.desc())
        .all()
    )

    # --------------------------------------------------------
    # 3. No analysis found
    # --------------------------------------------------------

    if not analyses:
        return {"student_id": student_id, "has_analysis": False, "analyses": []}

    return {
        "student_id": student_id,
        "has_analysis": True,
        "analyses": [
            {
                "id": analysis.id,
                "interest": analysis.interest,
                "interest_score": analysis.interest_score,
                "confidence_score": analysis.confidence_score,
                "experience_score": analysis.experience_score,
                "capability_score": analysis.capability_score,
                "strengths": parse_json_safely(analysis.strengths),
                "skill_gaps": parse_json_safely(analysis.skill_gaps),
                "potential_directions": parse_json_safely(
                    analysis.potential_directions
                ),
                "next_steps": parse_json_safely(analysis.next_steps),
                "evidence": parse_json_safely(analysis.evidence),
                "summary": analysis.summary,
                "analysis": analysis.analysis or analysis.summary,
            }
            for analysis in analyses
        ],
    }


# ============================================================
# STUDENT CONTEXT HELPER
# ============================================================


def _get_student_context(student_id: str, db: Session):
    """
    Helper to fetch student's active interest analysis,
    previous interests, and inferred existing skills
    for the AI pipeline.
    """

    latest_analysis = (
        db.query(InterestAnalysis)
        .filter(InterestAnalysis.student_id == student_id)
        .order_by(InterestAnalysis.id.desc())
        .first()
    )

    previous_interest_records = (
        db.query(StudentInterest).filter(StudentInterest.student_id == student_id).all()
    )

    previous_interests = [i.interest for i in previous_interest_records]

    existing_skills = []

    if latest_analysis:
        strengths = parse_json_safely(latest_analysis.strengths) or []

        if isinstance(strengths, list):
            existing_skills.extend(strengths)

    analysis_dict = {}

    if latest_analysis:

        analysis_dict = {
            "interest": latest_analysis.interest,
            "interest_score": latest_analysis.interest_score,
            "confidence_score": latest_analysis.confidence_score,
            "experience_score": latest_analysis.experience_score,
            "capability_score": latest_analysis.capability_score,
            "strengths": parse_json_safely(latest_analysis.strengths) or [],
            "skill_gaps": parse_json_safely(latest_analysis.skill_gaps) or [],
            "potential_directions": parse_json_safely(
                latest_analysis.potential_directions
            )
            or [],
            "next_steps": parse_json_safely(latest_analysis.next_steps) or [],
            "evidence": parse_json_safely(latest_analysis.evidence) or [],
            "summary": latest_analysis.summary or "",
        }

        # Include verified profile info from student record
        student_record = (
            db.query(Student).filter(Student.student_id == student_id).first()
        )

        if student_record:

            analysis_dict["student_profile"] = {
                "name": student_record.name,
                "attendance": student_record.attendance,
                "previous_sem_cgpa": student_record.previous_sem_cgpa,
                "extracurricular_count": (student_record.extracurricular_count),
            }

    return (latest_analysis, analysis_dict, existing_skills, previous_interests)


def _career_analysis_status(cached):
    if not cached:
        return "missing"

    if cached.transition_reason == "__PROCESSING__":
        return "processing"

    if isinstance(
        cached.transition_reason, str
    ) and cached.transition_reason.startswith("__ERROR__:"):
        return "error"

    required_fields = [
        cached.required_skills,
        cached.skill_assessments,
        cached.transferable_skills,
        cached.skill_gaps,
        cached.transition_difficulty,
        cached.transition_reason,
        cached.roadmap,
    ]

    if all(value not in (None, "") for value in required_fields):
        return "completed"

    return "incomplete"


def _career_error_message(cached):
    if not cached or not isinstance(cached.transition_reason, str):
        return "Career analysis failed."

    return (
        cached.transition_reason.replace(
            "__ERROR__:",
            "",
            1,
        ).strip()
        or "Career analysis failed."
    )


def _run_career_pivot_background(
    student_id: str,
    target_direction: str,
):
    db = SessionLocal()

    try:
        latest_analysis, analysis_dict, existing_skills, previous_interests = (
            _get_student_context(student_id, db)
        )

        if not latest_analysis:
            return

        print(
            f"[CAREER PIVOT BACKGROUND] Starting | "
            f"student={student_id} | direction={target_direction}",
            flush=True,
        )

        analysis_result = analyze_selected_direction(
            selected_direction=target_direction,
            existing_skills=existing_skills,
            previous_interests=previous_interests,
            interest_analysis=analysis_dict,
        )

        cached = (
            db.query(CareerPivotAnalysis)
            .filter(
                CareerPivotAnalysis.student_id == student_id,
                CareerPivotAnalysis.direction == target_direction,
            )
            .first()
        )

        if not cached:
            cached = CareerPivotAnalysis(
                student_id=student_id,
                interest=latest_analysis.interest,
                direction=target_direction,
            )
            db.add(cached)

        cached.interest = latest_analysis.interest
        cached.required_skills = json.dumps(
            [s.model_dump() for s in analysis_result.required_skills]
        )
        cached.skill_assessments = json.dumps(
            [a.model_dump() for a in analysis_result.skill_assessments]
        )
        cached.transferable_skills = json.dumps(
            [t.model_dump() for t in analysis_result.transferable_skills]
        )
        cached.skill_gaps = json.dumps(
            [g.model_dump() for g in analysis_result.skill_gaps]
        )
        cached.transition_difficulty = analysis_result.transition_difficulty
        cached.transition_reason = analysis_result.transition_reason
        cached.roadmap = json.dumps([r.model_dump() for r in analysis_result.roadmap])

        db.commit()

        print(
            f"[CAREER PIVOT BACKGROUND] Completed | "
            f"student={student_id} | direction={target_direction}",
            flush=True,
        )

    except Exception as e:
        print(
            f"[CAREER PIVOT BACKGROUND] Failed | " f"{type(e).__name__}: {e}",
            flush=True,
        )

        try:
            cached = (
                db.query(CareerPivotAnalysis)
                .filter(
                    CareerPivotAnalysis.student_id == student_id,
                    CareerPivotAnalysis.direction == target_direction,
                )
                .first()
            )

            if cached:
                cached.transition_difficulty = None
                cached.transition_reason = f"__ERROR__:{type(e).__name__}: {e}"
                db.commit()

        except Exception:
            db.rollback()

    finally:
        db.close()


# ============================================================
# DISCOVER CAREER DIRECTIONS
# ============================================================


@router.get("/{student_id}/career-directions")
def get_career_directions(
    student_id: str,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    (
        latest_analysis,
        analysis_dict,
        existing_skills,
        previous_interests,
    ) = _get_student_context(student_id, db)

    if not latest_analysis:
        return {
            "has_analysis": False,
            "student_id": student_id,
            "directions": [],
            "message": (
                "Complete the Interest+ quiz first " "to discover career directions."
            ),
        }

    # Use cached directions unless refresh is requested
    cached_directions = parse_json_safely(latest_analysis.potential_directions) or []

    if cached_directions and not force_refresh:

        # Old format may be strings
        directions = [
            ({"name": d, "fit_score": None} if isinstance(d, str) else d)
            for d in cached_directions
        ]

        return {
            "has_analysis": True,
            "student_id": student_id,
            "interest": latest_analysis.interest,
            "directions": directions,
        }

    # Generate directions
    result = discover_career_directions(
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        interest_analysis=analysis_dict,
    )

    directions = [direction.model_dump() for direction in result.directions]

    # Cache them
    latest_analysis.potential_directions = json.dumps(directions)

    db.commit()

    return {
        "has_analysis": True,
        "student_id": student_id,
        "interest": latest_analysis.interest,
        "directions": directions,
    }


# ============================================================
# GET SKILL GAP ANALYSIS
# ============================================================


@router.get("/{student_id}/skill-gap")
def get_skill_gap(
    student_id: str,
    direction: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    student = db.query(Student).filter(Student.student_id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    latest_analysis, analysis_dict, existing_skills, previous_interests = (
        _get_student_context(student_id, db)
    )

    if not latest_analysis:
        return {
            "has_analysis": False,
            "student_id": student_id,
            "detail": (
                "Interest analysis is not available yet. "
                "Please complete the Interest+ discovery quiz first."
            ),
            "data": None,
        }

    # --------------------------------------------------------
    # Determine direction
    # --------------------------------------------------------

    target_direction = (direction or "").strip()

    if not target_direction:

        pot_dirs = analysis_dict.get("potential_directions") or []

        if pot_dirs and isinstance(pot_dirs, list) and len(pot_dirs) > 0:

            target_direction = (
                pot_dirs[0]
                if isinstance(pot_dirs[0], str)
                else pot_dirs[0].get("name", "")
            )

        else:

            dir_res = discover_career_directions(
                existing_skills=existing_skills,
                previous_interests=previous_interests,
                interest_analysis=analysis_dict,
            )

            if dir_res.directions:
                target_direction = dir_res.directions[0].name
            else:
                target_direction = latest_analysis.interest

    # --------------------------------------------------------
    # Check cached CareerPivotAnalysis in DB
    # --------------------------------------------------------

    cached = (
        db.query(CareerPivotAnalysis)
        .filter(
            CareerPivotAnalysis.student_id == student_id,
            CareerPivotAnalysis.direction == target_direction,
        )
        .first()
    )

    status = _career_analysis_status(cached)

    if status == "completed" and not force_refresh:
        return {
            "has_analysis": True,
            "status": "completed",
            "student_id": student_id,
            "interest": cached.interest,
            "direction": cached.direction,
            "required_skills": parse_json_safely(cached.required_skills) or [],
            "skill_assessments": parse_json_safely(cached.skill_assessments) or [],
            "transferable_skills": parse_json_safely(cached.transferable_skills) or [],
            "skill_gaps": parse_json_safely(cached.skill_gaps) or [],
            "transition_difficulty": cached.transition_difficulty,
            "transition_reason": cached.transition_reason,
            "roadmap": parse_json_safely(cached.roadmap) or [],
        }

    if status == "processing":
        return JSONResponse(
            status_code=202,
            content={
                "has_analysis": False,
                "status": "processing",
                "student_id": student_id,
                "interest": latest_analysis.interest,
                "direction": target_direction,
                "message": "Career analysis is being generated.",
            },
        )

    if not cached:
        cached = CareerPivotAnalysis(
            student_id=student_id,
            interest=latest_analysis.interest,
            direction=target_direction,
        )
        db.add(cached)

    cached.interest = latest_analysis.interest
    cached.required_skills = None
    cached.skill_assessments = None
    cached.transferable_skills = None
    cached.skill_gaps = None
    cached.transition_difficulty = None
    cached.transition_reason = "__PROCESSING__"
    cached.roadmap = None

    db.commit()

    background_tasks.add_task(
        _run_career_pivot_background,
        student_id,
        target_direction,
    )

    return JSONResponse(
        status_code=202,
        content={
            "has_analysis": False,
            "status": "processing",
            "student_id": student_id,
            "interest": latest_analysis.interest,
            "direction": target_direction,
            "message": "Career analysis started.",
        },
    )


# ============================================================
# GET ROADMAP
# ============================================================


@router.get("/{student_id}/roadmap")
def get_roadmap(
    student_id: str,
    direction: str | None = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    # Reuse the same pipeline which produces
    # both skill gap and roadmap.

    gap_data = get_skill_gap(
        student_id=student_id,
        direction=direction,
        force_refresh=force_refresh,
        db=db,
        current_user=current_user,
    )

    if not gap_data.get("has_analysis"):
        return {
            "has_analysis": False,
            "student_id": student_id,
            "detail": gap_data.get(
                "detail", "Roadmap unavailable. Complete Interest+ first."
            ),
            "roadmap": [],
        }

    return {
        "has_analysis": True,
        "student_id": student_id,
        "interest": gap_data.get("interest"),
        "direction": gap_data.get("direction"),
        "transition_difficulty": gap_data.get("transition_difficulty"),
        "transition_reason": gap_data.get("transition_reason"),
        "roadmap": gap_data.get("roadmap") or [],
    }


# ============================================================
# ANALYZE SPECIFIC CAREER DIRECTION
# ============================================================


@router.post("/{student_id}/career-pivot/analyze")
def trigger_career_pivot_analysis(
    student_id: str,
    body: CareerDirectionAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_student),
):

    verify_student_access(student_id, current_user)

    target_direction = (direction or "").strip()

    if not target_direction:

        (
            latest_analysis,
            analysis_dict,
            existing_skills,
            previous_interests,
        ) = _get_student_context(student_id, db)

        if not latest_analysis:
            return {
                "has_analysis": False,
                "student_id": student_id,
                "roadmap": [],
                "detail": ("Roadmap unavailable. " "Complete Interest+ first."),
            }

        potential_directions = (
            parse_json_safely(latest_analysis.potential_directions) or []
        )

        if potential_directions:
            first = potential_directions[0]

            target_direction = (
                first if isinstance(first, str) else first.get("name", "")
            )

        else:
            target_direction = latest_analysis.interest

    cached = (
        db.query(CareerPivotAnalysis)
        .filter(
            CareerPivotAnalysis.student_id == student_id,
            CareerPivotAnalysis.direction == target_direction,
        )
        .first()
    )

    status = _career_analysis_status(cached)

    if status != "completed":

        return {
            "has_analysis": False,
            "status": status,
            "student_id": student_id,
            "direction": target_direction,
            "roadmap": [],
        }

    return {
        "has_analysis": True,
        "status": "completed",
        "student_id": student_id,
        "interest": cached.interest,
        "direction": cached.direction,
        "transition_difficulty": cached.transition_difficulty,
        "transition_reason": cached.transition_reason,
        "roadmap": parse_json_safely(cached.roadmap) or [],
    }
