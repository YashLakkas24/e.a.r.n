from pathlib import Path
import sys
import os
import tempfile
from io import BytesIO
from database import SessionLocal
from models import Student, User
from pwdlib import PasswordHash

import pandas as pd

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from auth_dependencies import require_teacher

# =========================================================
# PROJECT PATH
# =========================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# =========================================================
# RISK ENGINE
# =========================================================

from ai.risk_engine.risk_engine import analyze_dataset

# =========================================================
# AI ANALYSIS
# =========================================================

from ai.risk_engine.ai_analysis import generate_ai_analysis

# =========================================================
# ROUTER
# =========================================================

router = APIRouter(prefix="/api/teacher", tags=["Teacher"])


# =========================================================
# DATASET
# =========================================================

UPLOAD_DIR = PROJECT_ROOT / "uploads"
UPLOADED_CSV_PATH = UPLOAD_DIR / "active_dataset.csv"

password_hash = PasswordHash.recommended()

# =========================================================
# REQUIRED CSV COLUMNS
# =========================================================

REQUIRED_COLUMNS = {
    "student_id",
    "name",
    "attendance",
    "internal_marks",
    "assignment_score",
    "test_1",
    "test_2",
    "test_3",
    "practical_marks",
    "previous_sem_cgpa",
    "hackathon_count",
    "extracurricular_count",
}


# =========================================================
# ANALYSIS CACHE
# =========================================================

analysis_cache = None


# =========================================================
# AI SECTION PARSER
# =========================================================


def extract_ai_section(ai_text, section_name, next_section=None):
    """
    Extract a section from the AI response.
    """

    if not ai_text:
        return ""

    text = str(ai_text).strip()

    marker = f"{section_name}:"

    if marker not in text:
        return ""

    content = text.split(marker, 1)[1].strip()

    if next_section:
        next_marker = f"{next_section}:"

        if next_marker in content:
            content = content.split(next_marker, 1)[0].strip()

    return content


# =========================================================
# EXTRACT AI INTERVENTION
# =========================================================


def extract_ai_intervention(ai_text):
    """
    Extract exactly two short intervention lines.
    """

    content = extract_ai_section(ai_text, "AI Intervention", "AI Suggestion")

    if not content:
        return []

    lines = [line.strip() for line in content.splitlines() if line.strip()]

    cleaned = []

    for line in lines:

        line = line.lstrip("-•*123456789. ").strip()

        if line:
            cleaned.append(line)

    return cleaned[:2]


# =========================================================
# EXTRACT AI SUGGESTION
# =========================================================


def extract_ai_suggestion(ai_text):
    """
    Extract the AI Suggestion separately.
    """

    suggestion = extract_ai_section(ai_text, "AI Suggestion")

    if not suggestion:
        return ""

    return suggestion.strip()


# =========================================================
# EXTRACT AI ANALYSIS
# =========================================================


def extract_ai_analysis(ai_text):
    """
    Extract the main Analysis section.
    """

    analysis = extract_ai_section(ai_text, "Analysis", "AI Intervention")

    return analysis.strip() if analysis else ""


# =========================================================
# CSV VALIDATION
# =========================================================


def validate_uploaded_csv(df):
    """
    Validate the uploaded student CSV before replacing
    the existing active dataset.
    """

    # Remove accidental spaces around column names
    df.columns = [str(column).strip() for column in df.columns]

    # -----------------------------------------------------
    # REQUIRED COLUMNS
    # -----------------------------------------------------

    missing_columns = REQUIRED_COLUMNS - set(df.columns)

    if missing_columns:

        missing = ", ".join(sorted(missing_columns))

        raise HTTPException(
            status_code=400,
            detail=("Invalid student CSV. " f"Missing required columns: {missing}"),
        )

    # -----------------------------------------------------
    # EMPTY CSV
    # -----------------------------------------------------

    if df.empty:

        raise HTTPException(status_code=400, detail="The uploaded CSV is empty.")

    # -----------------------------------------------------
    # STUDENT ID
    # -----------------------------------------------------

    if df["student_id"].isnull().any():

        raise HTTPException(
            status_code=400, detail="Some students are missing student_id."
        )

    # -----------------------------------------------------
    # NAME
    # -----------------------------------------------------

    if df["name"].isnull().any():

        raise HTTPException(status_code=400, detail="Some students are missing name.")

    # -----------------------------------------------------
    # DUPLICATE STUDENT IDs
    # -----------------------------------------------------

    if df["student_id"].duplicated().any():

        raise HTTPException(
            status_code=400, detail="Duplicate student_id values found in CSV."
        )

    # -----------------------------------------------------
    # NUMERIC COLUMNS
    # -----------------------------------------------------

    numeric_columns = [
        "attendance",
        "internal_marks",
        "assignment_score",
        "test_1",
        "test_2",
        "test_3",
        "practical_marks",
        "previous_sem_cgpa",
        "hackathon_count",
        "extracurricular_count",
    ]

    for column in numeric_columns:

        converted = pd.to_numeric(df[column], errors="coerce")

        if converted.isnull().any():

            raise HTTPException(
                status_code=400,
                detail=(f"Column '{column}' " "contains invalid numeric values."),
            )

        # Store the converted numeric values
        df[column] = converted

    return df


# =========================================================
# UPLOAD STUDENT CSV
# =========================================================


@router.post("/upload-csv")
async def upload_student_csv(
    file: UploadFile = File(...), current_user: dict = Depends(require_teacher)
):
    """
    Upload the student CSV used by Teacher Analytics.

    Teacher can upload any CSV filename.

    The backend:
        1. Reads the uploaded CSV
        2. Validates required columns
        3. Saves it internally as active_dataset.csv
        4. Clears old risk-analysis cache
        5. Uses this dataset for Teacher Analytics
    """

    global analysis_cache

    # -----------------------------------------------------
    # CHECK FILE
    # -----------------------------------------------------

    if not file.filename:

        raise HTTPException(status_code=400, detail="No file selected.")

    filename = file.filename.lower()

    if not filename.endswith(".csv"):

        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")

    # -----------------------------------------------------
    # READ UPLOADED FILE
    # -----------------------------------------------------

    try:

        file_contents = await file.read()

        if not file_contents:

            raise HTTPException(status_code=400, detail="The uploaded CSV is empty.")

        df = pd.read_csv(BytesIO(file_contents))

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=400, detail=("Could not read the CSV file: " f"{str(e)}")
        )

    # -----------------------------------------------------
    # VALIDATE CSV
    # -----------------------------------------------------

    df = validate_uploaded_csv(df)

    # -----------------------------------------------------
    # MAKE SURE DATASET DIRECTORY EXISTS
    # -----------------------------------------------------

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------
    # WRITE TEMPORARY FILE FIRST
    # -----------------------------------------------------

    temp_path = None

    try:

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".csv",
            delete=False,
            dir=UPLOAD_DIR,
            encoding="utf-8",
            newline="",
        ) as temp_file:

            temp_path = Path(temp_file.name)

            df.to_csv(temp_file, index=False)

        # -------------------------------------------------
        # REPLACE ACTIVE DATASET
        # -------------------------------------------------

        os.replace(temp_path, UPLOADED_CSV_PATH)
        # =========================================================
        # SYNC UPLOADED STUDENTS INTO DATABASE
        # =========================================================

        db = SessionLocal()

        try:

            for _, row in df.iterrows():

                student_id = str(row["student_id"]).strip()

                existing_student = (
                    db.query(Student).filter(Student.student_id == student_id).first()
                )

                if existing_student:

                    # Update existing student
                    existing_student.name = str(row["name"]).strip()

                    existing_student.roll_number = str(row["student_id"]).strip()

                    existing_student.attendance = int(row["attendance"])

                    existing_student.previous_sem_cgpa = float(row["previous_sem_cgpa"])

                    existing_student.extracurricular_count = int(
                        row["extracurricular_count"]
                    )

                else:

                    # Create new student
                    new_student = Student(
                        student_id=student_id,
                        name=str(row["name"]).strip(),
                        roll_number=student_id,
                        attendance=int(row["attendance"]),
                        previous_sem_cgpa=float(row["previous_sem_cgpa"]),
                        extracurricular_count=int(row["extracurricular_count"]),
                        year=None,
                        branch=None,
                        preferences="",
                        interests=[],
                    )

                    db.add(new_student)
            # =========================================================
            # SYNC STUDENT LOGIN USERS
            # =========================================================

            for _, row in df.iterrows():

                user_id = str(row["student_id"]).strip().upper()
                full_name = str(row["name"]).strip()

                existing_user = db.query(User).filter(User.user_id == user_id).first()

                if existing_user:
                    existing_user.full_name = full_name

                else:
                    db.add(
                        User(
                            user_id=user_id,
                            full_name=full_name,
                            password_hash=password_hash.hash(f"student{user_id[-3:]}"),
                            role="student",
                        )
                    )
            db.commit()

            print(f"Database student sync completed: {len(df)} students", flush=True)

        except Exception as e:

            db.rollback()

            print("Student database sync failed:", repr(e), flush=True)

            raise HTTPException(
                status_code=500,
                detail=(
                    "CSV uploaded, but students could not "
                    "be synchronized with the database."
                ),
            )

        finally:

            db.close()

        print("================================")
        print("UPLOADED CSV PATH:", UPLOADED_CSV_PATH)
        print("UPLOADED FILE EXISTS:", UPLOADED_CSV_PATH.exists())
        print("UPLOADED STUDENT COUNT:", len(df))
        print("================================")

        temp_path = None

    except Exception as e:

        raise HTTPException(
            status_code=500, detail=("Failed to save the uploaded CSV: " f"{str(e)}")
        )

    finally:

        if temp_path and temp_path.exists():

            try:
                temp_path.unlink()
            except Exception:
                pass

    # -----------------------------------------------------
    # CLEAR OLD ANALYSIS CACHE
    # -----------------------------------------------------

    analysis_cache = None

    print("Teacher CSV uploaded successfully:", file.filename)

    print("Students loaded:", len(df))

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "status": "success",
        "message": "Student CSV uploaded successfully.",
        "filename": file.filename,
        "student_count": len(df),
    }


# =========================================================
# LOAD DETERMINISTIC ANALYSIS
# =========================================================


def load_analysis():
    """
    Load the currently uploaded teacher dataset and calculate:

    - Risk score
    - Risk level
    - Trend
    - Risk factors
    - Explanation

    NO AI CALLS happen here.
    """

    global analysis_cache

    # -----------------------------------------------------
    # CACHE HIT
    # -----------------------------------------------------

    if analysis_cache is not None:

        print("Teacher analytics: using cached risk analysis.")

        return analysis_cache

    # -----------------------------------------------------
    # CHECK ACTIVE DATASET
    # -----------------------------------------------------

    if not UPLOADED_CSV_PATH.exists():

        raise HTTPException(
            status_code=404,
            detail=(
                "No student CSV has been uploaded yet. "
                f"Expected active dataset at: "
                f"{UPLOADED_CSV_PATH}"
            ),
        )

    # -----------------------------------------------------
    # READ ACTIVE CSV
    # -----------------------------------------------------

    print("================================")
    print("ANALYTICS CSV PATH:", UPLOADED_CSV_PATH)
    print("ANALYTICS FILE EXISTS:", UPLOADED_CSV_PATH.exists())
    print("================================")

    try:

        df = pd.read_csv(UPLOADED_CSV_PATH)

    except Exception as e:

        raise HTTPException(
            status_code=500, detail=("Failed to read student dataset: " f"{str(e)}")
        )

    # -----------------------------------------------------
    # VALIDATE ACTIVE DATASET
    # -----------------------------------------------------

    try:

        df = validate_uploaded_csv(df)

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=("Active student dataset validation failed: " f"{str(e)}"),
        )

    # -----------------------------------------------------
    # RUN DETERMINISTIC RISK ENGINE
    # -----------------------------------------------------

    try:

        print("Teacher analytics: " "calculating student risk levels...")

        results = analyze_dataset(df)

    except Exception as e:

        print("Teacher analytics risk error:", repr(e))

        raise HTTPException(
            status_code=500, detail=("Risk analysis failed: " f"{str(e)}")
        )

    # -----------------------------------------------------
    # STORE DETERMINISTIC RESULTS
    # -----------------------------------------------------

    analysis_cache = results

    print("Teacher analytics: " "risk analysis completed.")

    return analysis_cache


# =========================================================
# GET RAW STUDENT RECORD
# =========================================================


def get_student_from_csv(student_id):

    if not UPLOADED_CSV_PATH.exists():

        raise HTTPException(
            status_code=404,
            detail=("Student dataset not found at: " f"{UPLOADED_CSV_PATH}"),
        )

    try:

        df = pd.read_csv(UPLOADED_CSV_PATH)

    except Exception as e:

        raise HTTPException(
            status_code=500, detail=("Failed to read student dataset: " f"{str(e)}")
        )

    for _, student in df.iterrows():

        if str(student["student_id"]) == str(student_id):

            return student

    raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")


# =========================================================
# CLEAR CACHE
# =========================================================


@router.post("/clear-cache")
def clear_analysis_cache(current_user: dict = Depends(require_teacher)):

    global analysis_cache

    analysis_cache = None

    return {
        "status": "success",
        "message": (
            "Risk analysis cache cleared. " "No AI results are stored in this cache."
        ),
    }


# =========================================================
# GET /api/teacher/report
# =========================================================


@router.get("/report")
def get_student_report(current_user: dict = Depends(require_teacher)):

    if not UPLOADED_CSV_PATH.exists():

        raise HTTPException(
            status_code=404,
            detail=("Student dataset not found at: " f"{UPLOADED_CSV_PATH}"),
        )

    try:

        df = pd.read_csv(UPLOADED_CSV_PATH)

        students = df.to_dict(orient="records")

        return {
            "status": "success",
            "total_students": len(students),
            "students": students,
        }

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


# =========================================================
# GET /api/teacher/analytics
# =========================================================


@router.get("/analytics")
def get_teacher_analytics(current_user: dict = Depends(require_teacher)):

    results = load_analysis()

    risk_summary = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}

    students = {"HIGH": [], "MEDIUM": [], "LOW": []}

    # -----------------------------------------------------
    # PROCESS STUDENTS
    # -----------------------------------------------------

    for result in results:

        risk_level = result.get("risk_level")

        if risk_level not in risk_summary:
            continue

        risk_summary[risk_level] += 1

        student_info = {
            "student_id": result.get("student_id"),
            "student_name": result.get("name"),
            "risk_level": risk_level,
            "risk_score": result.get("risk_score"),
            "performance_trend": result.get("trend", "STABLE"),
            "intervention": {
                "reasons": result.get("risk_factors", []),
                "recommendation": "",
            },
            "ai_analysis": None,
        }

        students[risk_level].append(student_info)

    return {
        "status": "success",
        "total_students": len(results),
        "risk_summary": risk_summary,
        "students": students,
    }


# =========================================================
# GET /api/teacher/risk-summary
# =========================================================


@router.get("/risk-summary")
def get_risk_summary(current_user: dict = Depends(require_teacher)):

    results = load_analysis()

    summary = {"high": 0, "medium": 0, "low": 0}

    for result in results:

        risk_level = result.get("risk_level")

        if risk_level == "HIGH":

            summary["high"] += 1

        elif risk_level == "MEDIUM":

            summary["medium"] += 1

        elif risk_level == "LOW":

            summary["low"] += 1

    return summary


# =========================================================
# GET /api/teacher/performance-trend
# =========================================================


@router.get("/performance-trend")
def get_performance_trend(current_user: dict = Depends(require_teacher)):

    results = load_analysis()

    trend_data = []

    for result in results:

        trend_data.append(
            {
                "student_id": result.get("student_id"),
                "student_name": result.get("name"),
                "trend_score": result.get("risk_score", 0),
                "trend": result.get("trend", "STABLE"),
            }
        )

    return trend_data


# =========================================================
# GET /api/teacher/students
# =========================================================


@router.get("/students")
def get_students_by_risk(risk: str, current_user: dict = Depends(require_teacher)):

    risk = risk.upper()

    if risk not in {"HIGH", "MEDIUM", "LOW"}:

        raise HTTPException(
            status_code=400, detail=("Risk must be HIGH, " "MEDIUM or LOW.")
        )

    results = load_analysis()

    students = []

    for result in results:

        if result.get("risk_level") == risk:

            students.append(
                {
                    "student_id": result.get("student_id"),
                    "student_name": result.get("name"),
                    "risk_level": result.get("risk_level"),
                }
            )

    return students


# =========================================================
# GET /api/teacher/students/{student_id}
# =========================================================


@router.get("/students/{student_id}")
def get_student_details(student_id: str, current_user: dict = Depends(require_teacher)):

    # -----------------------------------------------------
    # STEP 1
    # Deterministic risk results
    # -----------------------------------------------------

    results = load_analysis()

    # -----------------------------------------------------
    # STEP 2
    # Find selected student
    # -----------------------------------------------------

    selected_result = None

    for result in results:

        if str(result.get("student_id")) == str(student_id):

            selected_result = result
            break

    if selected_result is None:

        raise HTTPException(
            status_code=404, detail=(f"Student {student_id} " "not found.")
        )

    # -----------------------------------------------------
    # STEP 3
    # Get complete student data
    # -----------------------------------------------------

    student = get_student_from_csv(student_id)

    # -----------------------------------------------------
    # STEP 4
    # RUN AI ONLY FOR SELECTED STUDENT
    # -----------------------------------------------------

    print(f"AI analysis requested for student " f"{student_id}...")

    try:

        ai_text = generate_ai_analysis(student, selected_result)

    except Exception as e:

        print("Student AI analysis error:", repr(e))

        ai_text = "AI analysis unavailable.\n" f"AI error: {str(e)}"

    # -----------------------------------------------------
    # STEP 5
    # AI INTERVENTION
    # -----------------------------------------------------

    ai_intervention = extract_ai_intervention(ai_text)

    # -----------------------------------------------------
    # STEP 6
    # AI SUGGESTION
    # -----------------------------------------------------

    ai_suggestion = extract_ai_suggestion(ai_text)

    ai_analysis = extract_ai_analysis(ai_text)

    # -----------------------------------------------------
    # STEP 7
    # FALLBACK
    # -----------------------------------------------------

    if len(ai_intervention) == 0:

        risk_factors = selected_result.get("risk_factors", [])

        ai_intervention = [str(factor) for factor in risk_factors[:2]]

    if len(ai_intervention) == 0:

        ai_intervention = [
            "Continue monitoring the student's academic performance.",
            "Review future attendance and assessment trends.",
        ]

    while len(ai_intervention) < 2:

        ai_intervention.append("Continue monitoring the student's academic progress.")

    ai_intervention = ai_intervention[:2]

    # -----------------------------------------------------
    # AI SUGGESTION FALLBACK
    # -----------------------------------------------------

    if not ai_suggestion:

        ai_suggestion = (
            "Continue monitoring the student's "
            "academic performance and review progress "
            "during the next assessment."
        )

    # -----------------------------------------------------
    # FINAL RESPONSE
    # -----------------------------------------------------

    return {
        "student_id": selected_result.get("student_id"),
        "student_name": selected_result.get("name"),
        "risk_level": selected_result.get("risk_level"),
        "performance_trend": selected_result.get("trend", "STABLE"),
        "analysis": ai_analysis,
        "intervention": {
            "reasons": ai_intervention,
            "recommendation": "",
        },
        "ai_analysis": ai_suggestion,
    }
