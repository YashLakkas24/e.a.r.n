from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    user_id: str
    password: str  # what react will send to FASTAPI
    role: str


class LoginResponse(BaseModel):
    message: str
    user_id: str
    full_name: str  # what fastapi will return after successful login
    role: str
    firebase_token: str


class NoticeEligibility(BaseModel):
    branches: List[str] = Field(
        default_factory=lambda: ["ALL"],
        description="Eligible academic branches. Use ALL when there is no restriction.",
    )

    years: List[int] = Field(
        default_factory=list,
        description="Eligible student years. Empty means all years.",
    )

    other_criteria: Optional[str] = Field(
        default=None,
        description="Other explicitly stated eligibility requirements.",
    )


class NoticeMetadata(BaseModel):
    title: str

    category: str

    is_mandatory: bool

    eligibility: NoticeEligibility

    deadline: Optional[date] = None

    summary: str

    registration_link: Optional[str] = None

    required_action: Optional[str] = None

    importance: str = "NORMAL"
