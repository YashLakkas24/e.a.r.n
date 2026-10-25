from typing import Literal

from pydantic import BaseModel, Field


SkillLevel = Literal[
    "unknown",
    "beginner",
    "developing",
    "intermediate",
    "strong",
    "advanced",
]

AssessmentBasis = Literal[
    "evidence_based",
    "estimated",
    "unknown",
]

ConfidenceLevel = Literal[
    "low",
    "medium",
    "high",
]


class Direction(BaseModel):
    name: str
    fit_score: int = Field(ge=0, le=100)
    reason: str

class DirectionDiscoveryResult(BaseModel):
    directions: list[Direction]

class SkillRequirement(BaseModel):
    skill: str
    importance: int = Field(ge=0, le=100)
    required_level: SkillLevel
    reason: str

class SkillDiscoveryResult(BaseModel):
    direction: str
    skills: list[SkillRequirement]

class SkillAssessment(BaseModel):
    skill: str
    current_level: SkillLevel
    assessment_basis: AssessmentBasis
    confidence: ConfidenceLevel
    evidence: str

class SkillAssessmentResult(BaseModel):
    skill_assessments: list[SkillAssessment]

class TransferableSkill(BaseModel):
    skill: str
    source: str
    relevance: Literal[
        "low",
        "medium",
        "high",
    ]
    explanation: str

class TransferableSkillResult(BaseModel):
    direction: str
    transferable_skills: list[TransferableSkill]

class SkillGap(BaseModel):
    skill: str
    current_level: SkillLevel
    required_level: SkillLevel
    status: Literal[
        "no_gap",
        "small_gap",
        "actual_gap",
        "assessment_needed",
    ]
    explanation: str

class SkillGapResult(BaseModel):
    direction: str
    skill_gaps: list[SkillGap]    



class CareerSkillGapAnalysis(BaseModel):
    """Core career analysis needed by the Skill Gaps page.

    Roadmap generation is intentionally separate so these results can
    be returned as soon as the skill assessment stages are complete.
    """

    direction: str
    required_skills: list[SkillRequirement]
    skill_assessments: list[SkillAssessment]
    transferable_skills: list[TransferableSkill]
    skill_gaps: list[SkillGap]


class RoadmapStep(BaseModel):
    step: int
    title: str
    description: str
    skills: list[str]

class TransitionRoadmapResult(BaseModel):
    transition_difficulty: Literal[
        "low",
        "moderate",
        "high",
    ]

    transition_reason: str

    roadmap: list[RoadmapStep]

class CareerDirectionAnalysis(BaseModel):
    """
    Complete Career Pivot analysis for ONE direction
    selected by the student.
    """
    direction: str

    required_skills: list[SkillRequirement]

    skill_assessments: list[SkillAssessment]

    transferable_skills: list[TransferableSkill]

    skill_gaps: list[SkillGap]

    transition_difficulty: Literal[
        "low",
        "moderate",
        "high",
    ]

    transition_reason: str

    roadmap: list[RoadmapStep]