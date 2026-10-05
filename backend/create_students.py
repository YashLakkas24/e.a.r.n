import pandas as pd
from pathlib import Path
from sqlalchemy.orm import Session
from database import SessionLocal, Base, engine
from models import Student

Base.metadata.create_all(bind=engine)
# Path to the single source-of-truth CSV
CSV_PATH = Path(__file__).resolve().parent.parent / "ai" / "data" / "students.csv"


def create_students():

    db: Session = SessionLocal()

    try:

        # -------------------------
        # LOAD STUDENTS FROM CSV
        # -------------------------

        if not CSV_PATH.exists():
            raise FileNotFoundError(f"Students CSV not found: {CSV_PATH}")

        df = pd.read_csv(CSV_PATH)

        required_columns = [
            "student_id",
            "name",
            "attendance",
            "previous_sem_cgpa",
            "extracurricular_count",
        ]

        missing_columns = [
            column for column in required_columns if column not in df.columns
        ]

        if missing_columns:
            raise ValueError(f"Missing columns in students.csv: {missing_columns}")

        print(f"Loaded {len(df)} students from CSV")

        # -------------------------
        # CREATE / UPDATE STUDENTS
        # -------------------------

        for _, row in df.iterrows():

            student_id = str(row["student_id"]).strip()
            name = str(row["name"]).strip()

            existing_student = (
                db.query(Student).filter(Student.student_id == student_id).first()
            )

            if existing_student:

                # Update existing student
                existing_student.name = name
                existing_student.firebase_uid = student_id.upper()
                existing_student.roll_number = student_id[-3:]
                existing_student.attendance = int(row["attendance"])
                existing_student.previous_sem_cgpa = float(row["previous_sem_cgpa"])
                existing_student.extracurricular_count = int(
                    row["extracurricular_count"]
                )
                existing_student.year = 3
                existing_student.branch = "AIDS"
                print(f"Updated: {student_id}")

            else:

                student = Student(
                    student_id=student_id.upper(),
                    firebase_uid=student_id.upper(),
                    name=name,
                    roll_number=student_id[-3:],
                    year=3,
                    branch="AIDS",
                    attendance=int(row["attendance"]),
                    previous_sem_cgpa=float(row["previous_sem_cgpa"]),
                    extracurricular_count=int(row["extracurricular_count"]),
                )

                db.add(student)

                print(f"Created: {student_id}")

        db.commit()

        print("\nALL STUDENTS SYNCHRONIZED SUCCESSFULLY!")
        print(f"Total students: {len(df)}")

    except Exception as e:

        db.rollback()

        print("\nERROR:")
        print(e)

    finally:
        db.close()


if __name__ == "__main__":
    create_students()
