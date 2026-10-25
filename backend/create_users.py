import pandas as pd
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from database import SessionLocal, Base, engine
from models import User
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "ai" / "data" / "students.csv"

password_hash = PasswordHash.recommended()

Base.metadata.create_all(bind=engine)


teachers = [
    ("TCH001", "Prof. Sharma", "teacher001"),
    ("TCH002", "Prof. Patil", "teacher002"),
    ("TCH003", "Prof. Kulkarni", "teacher003"),
    ("TCH004", "Prof. Joshi", "teacher004"),
    ("TCH005", "Prof. Deshmukh", "teacher005"),
]


def create_users():

    df = pd.read_csv(CSV_PATH)

    db: Session = SessionLocal()

    try:

        # -------------------------
        # STUDENTS FROM CSV
        # -------------------------

        for _, row in df.iterrows():

            user_id = str(row["student_id"]).strip()
            name = str(row["name"]).strip()

            existing_user = db.query(User).filter(User.user_id == user_id).first()

            if existing_user:
                # Keep name synchronized
                existing_user.full_name = name
                print(f"{user_id} already exists. Skipping.")
                continue

            student = User(
                user_id=user_id,
                full_name=name,
                password_hash=password_hash.hash(f"student{user_id[-3:]}"),
                role="student",
            )

            db.add(student)

            print(f"Created student {user_id}")

        # -------------------------
        # TEACHERS
        # -------------------------

        for user_id, name, password in teachers:

            existing_user = db.query(User).filter(User.user_id == user_id).first()

            if existing_user:
                print(f"{user_id} already exists. Skipping.")
                continue

            teacher = User(
                user_id=user_id,
                full_name=name,
                password_hash=password_hash.hash(password),
                role="teacher",
            )

            db.add(teacher)

            print(f"Created teacher {user_id}")

        db.commit()

        print("\nSUCCESS: Users synchronized from CSV.")

    except Exception as e:

        db.rollback()

        print("\nERROR:", e)

    finally:
        db.close()


if __name__ == "__main__":
    create_users()
