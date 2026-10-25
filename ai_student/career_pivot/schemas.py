from typing import Literal

from pydantic import BaseModel, Field

EligibilityStatus = Literal[
    "possible_now",
    "possible_after_graduation",
    "additional_qualification_required",
    "needs_more_information",
    "not_possible",
]

PathwayType = Literal[
    "competitive_exam",
    "direct_recruitment",
    "higher_education",
    "private_or_social_sector",
    "mixed",
    "other",
]

RoadmapStepType = Literal[
    "eligibility_check",
    "education",
    "entrance_exam",
    "competitive_exam",
    "application",
    "selection_stage",
    "skill_development",
    "experience",
    "portfolio",
    "job_search",
    "other",
]

class CareerResource(BaseModel):
    label: str
    url: str
    description: str = ""


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
    # Increment when path discovery semantics change so cached activity-like
    # recommendations are regenerated instead of silently reused.
    pathway_version: Literal["career_role_routes_v3"] = "career_role_routes_v3"
    pathway_type: PathwayType = "other"
    pathway_summary: str = ""
    eligibility_status: EligibilityStatus = "needs_more_information"
    eligibility_reason: str = ""
    missing_information: list[str] = Field(default_factory=list)
    official_resources: list[CareerResource] = Field(default_factory=list)

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
    route_type: RoadmapStepType = "skill_development"
    estimated_duration: str = ""
    completion_evidence: str = ""
    official_resource_label: str = ""
    official_resource_url: str = ""

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