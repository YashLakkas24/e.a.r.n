import sys
from pathlib import Path
import os
from routes.notices import router as notices_router

# Add project root directory to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine, Base

# IMPORTANT:
# Import models before create_all()
# so SQLAlchemy knows about all tables.
from models import (
    User,
    Student,
    StudentInterest,
    QuizAnswer,
    InterestAnalysis,
    CareerPivotAnalysis,
    Notice,
    Notification,
)

from routes.auth import router as auth_router
from routes.teacher import router as teacher_router
from routes.student import router as student_router
from routes.interest import router as interest_router
from routes.interest_options import router as interest_options_router

app = FastAPI()


app.include_router(notices_router)

# ============================================================
# CREATE DATABASE TABLES
# ============================================================

Base.metadata.create_all(bind=engine)

# ============================================================
# SEED INITIAL DATA
# ============================================================

from create_students import create_students
from create_users import create_users

create_students()
create_users()

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ============================================================
# ROUTES
# ============================================================

app.include_router(auth_router)
app.include_router(teacher_router)
app.include_router(interest_router)
app.include_router(interest_options_router)
app.include_router(student_router)


# ============================================================
# HOME
# ============================================================


@app.get("/")
def home():
    return {"message": "Academic Early Warning Backend is running!"}


# ============================================================
# API TEST
# ============================================================


@app.get("/api/test")
def api_test():
    return {
        "project": "Academic Early Warning",
        "status": "Backend working",
        "member": "Member 1",
    }


# ============================================================
# DATABASE TEST
# ============================================================


@app.get("/api/test-db")
def test_database():

    try:

        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {"status": "success", "message": "FastAPI is connected to PostgreSQL!"}

    except Exception as e:

        return {"status": "error", "message": str(e)}
