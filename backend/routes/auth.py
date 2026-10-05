# authentication page, for student/teacher id and password

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pwdlib import PasswordHash

from database import SessionLocal
from models import User, Student
from schemas import LoginRequest, LoginResponse

from firebase_admin import auth as firebase_auth
import firebase_admin_config

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

password_hash = PasswordHash.recommended()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    # Clean the entered ID
    clean_user_id = login_data.user_id.strip().upper()

    # --------------------------------------------------
    # 1. Find user in PostgreSQL
    # --------------------------------------------------
    user = db.query(User).filter(User.user_id == clean_user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid ID or password")

    # --------------------------------------------------
    # 2. Verify PostgreSQL password
    # --------------------------------------------------
    if not password_hash.verify(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid ID or password")

    # --------------------------------------------------
    # 3. Verify selected role
    # --------------------------------------------------
    if user.role != login_data.role:
        raise HTTPException(
            status_code=401,
            detail=f"User is registered as a {user.role}, not a {login_data.role}",
        )

    if user.role == "student":
        student = db.query(Student).filter(Student.student_id == user.user_id).first()

        if student and student.firebase_uid != user.user_id:
            student.firebase_uid = user.user_id
            db.commit()
    # --------------------------------------------------
    # 4. Create Firebase Custom Token
    # --------------------------------------------------
    try:
        firebase_token = firebase_auth.create_custom_token(
            user.user_id, {"role": user.role}
        )

        # Firebase Admin SDK may return bytes
        if isinstance(firebase_token, bytes):
            firebase_token = firebase_token.decode("utf-8")

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Firebase authentication failed: {str(e)}"
        )

    # --------------------------------------------------
    # 5. Return user information + Firebase token
    # --------------------------------------------------
    return LoginResponse(
        message="Login successful",
        user_id=user.user_id,
        full_name=user.full_name,
        role=user.role,
        firebase_token=firebase_token,
    )
