import os
import json
import time

from openai import (
    RateLimitError,
    APIError,
    InternalServerError,
    APIConnectionError,
    APITimeoutError,
    NotFoundError,
)

from ai_student.llm.client import client
from ai_student.llm.schemas import (
    GeneratedQuestion,
    InterestAnalysis,
)
from ai_student.llm.prompts import (
    ADAPTIVE_QUESTION_SYSTEM_PROMPT,
)
from ai_student.quiz.question_engine import validate_question

from ai_student.career_pivot.prompts import (
    DIRECTION_DISCOVERY_SYSTEM_PROMPT,
    SKILL_DISCOVERY_SYSTEM_PROMPT,
    SKILL_ASSESSMENT_SYSTEM_PROMPT,
    SKILL_GAP_SYSTEM_PROMPT,
    TRANSFERABLE_SKILL_SYSTEM_PROMPT,
    TRANSITION_ROADMAP_SYSTEM_PROMPT,
)

from ai_student.career_pivot.schemas import (
    DirectionDiscoveryResult,
    SkillDiscoveryResult,
    SkillAssessmentResult,
    TransferableSkillResult,
    SkillGapResult,
    TransitionRoadmapResult,
)

# ============================================================
# OPENAI MODEL CONFIGURATION
# ============================================================

DEFAULT_MODEL = os.getenv("AI_MODEL", "gpt-5-nano")
SKILL_GAP_MODEL = os.getenv("SKILL_GAP_MODEL", DEFAULT_MODEL)

VALID_MODELS = [
    DEFAULT_MODEL,
]
# Remove duplicates while preserving order
VALID_MODELS = list(dict.fromkeys(VALID_MODELS))


def parse_json_from_llm(content: str) -> dict:
    """
    Robust JSON parser for LLM responses. Strips markdown fences,
    preambles, and extracts the outermost JSON object/array.
    """
    content = (content or "").strip()
    if not content:
        raise ValueError("Empty response from LLM")

    # Strip markdown code blocks
    if "```json" in content:
        content = content.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in content:
        content = content.split("```", 1)[1].split("```", 1)[0].strip()

    # Extract JSON object or array
    start_obj = content.find("{")
    end_obj = content.rfind("}")
    start_arr = content.find("[")
    end_arr = content.rfind("]")

    if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
        if start_arr == -1 or start_obj < start_arr:
            content = content[start_obj : end_obj + 1].strip()
        elif end_arr > start_arr:
            content = content[start_arr : end_arr + 1].strip()
    elif start_arr != -1 and end_arr != -1 and end_arr > start_arr:
        content = content[start_arr : end_arr + 1].strip()

    return json.loads(content)


# ============================================================
# OPENAI LLM CALL
# ============================================================


def safe_chat_completion(**kwargs):
    """
    Centralized OpenAI API call.

    Uses one controlled retry for temporary failures.

    The OpenAI client itself is configured with max_retries=0,
    so retry behavior is controlled only here.
    """

    max_retries = 1
    base_delay = 2.0

    kwargs["model"] = kwargs.get(
        "model",
        DEFAULT_MODEL,
    )

    # JSON output by default.
    kwargs.setdefault(
        "response_format",
        {"type": "json_object"},
    )

    model = kwargs["model"]

    for attempt in range(max_retries + 1):

        start_time = time.perf_counter()

        try:

            print(
                f"[OpenAI] Request starting | "
                f"model={model} | "
                f"attempt={attempt + 1}/{max_retries + 1}",
                flush=True,
            )

            response = client.chat.completions.create(**kwargs)

            elapsed = time.perf_counter() - start_time

            print(
                f"[OpenAI] Request completed | "
                f"model={model} | "
                f"time={elapsed:.2f}s",
                flush=True,
            )

            return response

        # ----------------------------------------------------
        # TIMEOUT
        # ----------------------------------------------------

        except APITimeoutError as e:

            elapsed = time.perf_counter() - start_time

            print(
                f"[OpenAI] TIMEOUT | " f"model={model} | " f"time={elapsed:.2f}s",
                flush=True,
            )

            if attempt >= max_retries:
                raise RuntimeError(
                    f"OpenAI request timed out after "
                    f"{elapsed:.1f}s for model '{model}'."
                ) from e

            time.sleep(base_delay)

        # ----------------------------------------------------
        # CONNECTION / SERVER / RATE LIMIT
        # ----------------------------------------------------

        except (
            RateLimitError,
            InternalServerError,
            APIConnectionError,
        ) as e:

            elapsed = time.perf_counter() - start_time

            print(
                f"[OpenAI] Temporary error | "
                f"model={model} | "
                f"time={elapsed:.2f}s | "
                f"error={type(e).__name__}",
                flush=True,
            )

            if attempt >= max_retries:
                raise

            sleep_time = base_delay * (attempt + 1)

            print(
                f"[OpenAI] Retrying in " f"{sleep_time:.0f}s...",
                flush=True,
            )

            time.sleep(sleep_time)

        # ----------------------------------------------------
        # MODEL / CONFIGURATION ERROR
        # ----------------------------------------------------

        except NotFoundError:
            raise

        # ----------------------------------------------------
        # OTHER OPENAI API ERRORS
        # ----------------------------------------------------

        except APIError:
            raise


MAX_QUESTIONS = 5


# ============================================================
# ADAPTIVE QUESTION GENERATION
# ============================================================


def generate_next_question(
    interest: str,
    conversation: list[dict],
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
) -> GeneratedQuestion | None:

    existing_skills = existing_skills or []
    previous_interests = previous_interests or []

    # --------------------------------------------------------
    # NEVER generate Q6
    # --------------------------------------------------------

    if len(conversation) >= MAX_QUESTIONS:
        return None

    question_number = len(conversation) + 1

    # --------------------------------------------------------
    # Tell AI exactly how much information remains
    # --------------------------------------------------------

    user_prompt = f"""
Student interest:
{interest}

Existing skills:
{json.dumps(existing_skills)}

Previous interests:
{json.dumps(previous_interests)}

Previous questions and answers:
{json.dumps(conversation)}

Current question number:
{question_number}

Maximum questions:
{MAX_QUESTIONS}

You MUST collect enough information within exactly 5 questions.

The assessment should explore:
1. Interest level
2. Practical experience
3. Confidence
4. Motivation / strengths
5. Development needs / relevant skills

IMPORTANT:
- Ask exactly ONE adaptive question for question number {question_number} of {MAX_QUESTIONS}.
- Do NOT repeat previous questions.
- Adapt the question based on the student's previous answers.
- For single_choice, provide 3 to 5 clear options.
- For multiple_choice, provide 3 to 6 options.
- For scale, provide 5 scale options (1 to 5).
- For text, options should be null or empty.
- NEVER return {{"completed": true}} before question 5. Always provide a full question structure.

Return ONLY this JSON structure:
{{
    "completed": false,
    "question_id": "q{question_number}_{interest.lower().replace(' ', '_')}",
    "question": "Clear question text here?",
    "response_type": "single_choice",
    "options": ["Option 1", "Option 2", "Option 3"]
}}

Do not use markdown code fences. Return ONLY valid JSON.
"""

    # ========================================================
    # LLM CALL
    # ========================================================

    response = safe_chat_completion(
        messages=[
            {
                "role": "system",
                "content": ADAPTIVE_QUESTION_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        max_completion_tokens=2000,
        response_format={
            "type": "json_object",
        },
    )

    # ========================================================
    # GET RESPONSE
    # ========================================================

    content = response.choices[0].message.content

    finish_reason = getattr(
        response.choices[0],
        "finish_reason",
        None,
    )

    if content is None:
        raise ValueError("AI returned an empty response.")

    content = content.strip()

    # ========================================================
    # REMOVE MARKDOWN CODE FENCE IF RETURNED
    # ========================================================

    if content.startswith("```"):
        if content.startswith("```json"):
            content = content[len("```json") :].strip()
        else:
            content = content[len("```") :].strip()

        if content.endswith("```"):
            content = content[:-3].strip()

    # ========================================================
    # DETECT TRUNCATION
    # ========================================================

    if finish_reason in (
        "length",
        "max_tokens",
        "MAX_TOKENS",
    ):
        raise ValueError("AI stopped generating because output reached token limit.")

    # ========================================================
    # PARSE JSON
    # ========================================================

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"AI did not return valid JSON: {e}\nResponse: {content}"
        ) from e

    # ========================================================
    # CHECK COMPLETION
    # ========================================================

    if data.get("completed") is True:
        if question_number < MAX_QUESTIONS:
            # If AI mistakenly flagged completion early, force a valid fallback question structure
            data["completed"] = False
            if not data.get("question"):
                data["question"] = (
                    f"What specific area in {interest} would you like to explore next?"
                )
                data["response_type"] = "single_choice"
                data["options"] = [
                    "Foundational Skills",
                    "Hands-on Projects",
                    "Industry Practices",
                    "Advanced Concepts",
                ]
                data["question_id"] = (
                    f"q{question_number}_{interest.lower().replace(' ', '_')}"
                )

    # ========================================================
    # VALIDATE GENERATED QUESTION
    # ========================================================

    try:
        question = GeneratedQuestion.model_validate(data)
    except Exception as e:
        raise ValueError(
            f"AI output does not match GeneratedQuestion schema:\n{data}"
        ) from e

    # ========================================================
    # VALIDATE QUESTION LOGIC
    # ========================================================

    return validate_question(question)


# ============================================================
# FINAL INTEREST ANALYSIS
# ============================================================


def generate_interest_analysis(
    system_prompt: str,
    user_prompt: str,
    thinking: bool = False,
    reasoning_effort: str = "medium",
) -> InterestAnalysis:

    response = safe_chat_completion(
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        max_completion_tokens=3000,
        response_format={"type": "json_object"},
    )

    finish_reason = getattr(
        response.choices[0],
        "finish_reason",
        None,
    )
    print(
        f"[OpenAI] Interest Analysis finish reason: {finish_reason}",
        flush=True,
    )

    content = response.choices[0].message.content.strip()

    try:
        data = parse_json_from_llm(content)

    except Exception as e:
        raise ValueError(
            "LLM did not return valid JSON.\n\n" f"Response:\n{content}"
        ) from e

    try:
        return InterestAnalysis.model_validate(data)

    except Exception as e:
        raise ValueError(
            "LLM output does not match " "InterestAnalysis schema.\n\n" f"Data:\n{data}"
        ) from e


# ============================================================
# CAREER DIRECTION DISCOVERY
# ============================================================


def generate_direction_discovery(
    interest: str,
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    interest_analysis: dict | None = None,
) -> DirectionDiscoveryResult:

    existing_skills = existing_skills or []
    previous_interests = previous_interests or []
    interest_analysis = interest_analysis or {}

    user_prompt = f"""
Current interest:
{interest}

Existing skills:
{json.dumps(existing_skills, indent=2)}

Previous interests:
{json.dumps(previous_interests, indent=2)}

Interest analysis:
{json.dumps(interest_analysis, indent=2)}

Identify approximately 3 to 5 realistic directions
that this student could explore.

Base the directions only on the information provided.
Do not invent skills, experience, achievements, or interests.

Return ONLY valid JSON.
"""

    response = safe_chat_completion(
        messages=[
            {
                "role": "system",
                "content": DIRECTION_DISCOVERY_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        max_completion_tokens=4000,
    )

    content = response.choices[0].message.content.strip()

    try:
        data = parse_json_from_llm(content)

    except Exception as e:
        raise ValueError(
            "LLM did not return valid JSON for "
            "direction discovery.\n\n"
            f"Response:\n{content}"
        ) from e

    try:
        return DirectionDiscoveryResult.model_validate(data)

    except Exception as e:
        raise ValueError(
            "LLM output does not match "
            "DirectionDiscoveryResult schema.\n\n"
            f"Data:\n{data}"
        ) from e


# ============================================================
# CAREER SKILL DISCOVERY
# ============================================================


def generate_skill_discovery(
    direction: str,
    interest: str,
    previous_interests: list[str] | None = None,
    existing_skills: list[str] | None = None,
    interest_analysis: dict | None = None,
) -> SkillDiscoveryResult:

    previous_interests = previous_interests or []
    existing_skills = existing_skills or []
    interest_analysis = interest_analysis or {}

    user_prompt = f"""
Selected direction:
{direction}

Current interest:
{interest}

Previous interests:
{json.dumps(previous_interests, indent=2)}

Existing skills:
{json.dumps(existing_skills, indent=2)}

Interest analysis:
{json.dumps(interest_analysis, indent=2)}

Dynamically identify 4 to 8 important skills that are
required or strongly useful for this specific direction.

Determine the skills from the actual direction and
student context.

Do not use a predefined skill list.

Rules:

- Identify skills genuinely relevant to the selected direction.
- Do not evaluate the student's current skill level.
- Do not calculate skill gaps.
- Do not identify transferable skills.
- Do not generate a roadmap.
- Do not remove an important skill just because the student
  does not currently possess it.
- Keep each reason concise: one or two sentences maximum.
- Return between 4 and 8 skills.
- Every skill must have all required fields.
- Do not add explanations outside the JSON.

Return ONLY valid JSON in this structure:

{{
    "direction": "{direction}",
    "skills": [
        {{
            "skill": "skill name",
            "importance": 85,
            "required_level": "intermediate",
            "reason": "Brief explanation of why this skill is important."
        }}
    ]
}}
"""

    response = safe_chat_completion(
        messages=[
            {
                "role": "system",
                "content": SKILL_DISCOVERY_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        max_completion_tokens=4000,
        response_format={
            "type": "json_object",
        },
    )

    # --------------------------------------------------------
    # GET RESPONSE
    # --------------------------------------------------------

    content = response.choices[0].message.content

    finish_reason = getattr(
        response.choices[0],
        "finish_reason",
        None,
    )

    print(
        f"\n[OpenAI] Skill Discovery finish reason: {finish_reason}",
        flush=True,
    )

    if content is None:
        raise ValueError("OpenAI returned an empty response for skill discovery.")

    content = content.strip()

    # --------------------------------------------------------
    # DEBUG
    # --------------------------------------------------------

    print("\n[OpenAI Skill Discovery Raw Response]")
    print(content)
    print("[End OpenAI Skill Discovery Raw Response]\n")

    # --------------------------------------------------------
    # PARSE JSON
    # --------------------------------------------------------

    try:
        data = parse_json_from_llm(content)

    except Exception as e:
        raise ValueError(
            "LLM did not return valid JSON for "
            "skill discovery.\n\n"
            f"JSON Error: {e}\n\n"
            f"Finish reason: {finish_reason}\n\n"
            f"Response:\n{content}"
        ) from e

    # --------------------------------------------------------
    # VALIDATE SCHEMA
    # --------------------------------------------------------

    try:
        return SkillDiscoveryResult.model_validate(data)

    except Exception as e:

        raise ValueError(
            "LLM output does not match "
            "SkillDiscoveryResult schema.\n\n"
            f"Data:\n{data}"
        ) from e


# ============================================================
# STAGE 3 — SKILL ASSESSMENT
# ============================================================


def generate_skill_assessment(
    direction: str,
    skills: list[str],
    interest: str,
    previous_interests: list[str] | None = None,
    existing_skills: list[str] | None = None,
    interest_analysis: dict | None = None,
) -> SkillAssessmentResult:

    previous_interests = previous_interests or []
    existing_skills = existing_skills or []
    interest_analysis = interest_analysis or {}

    user_prompt = f"""
SELECTED DIRECTION:
{direction}

DYNAMICALLY DISCOVERED SKILLS:
{json.dumps(skills, indent=2)}

CURRENT INTEREST:
{interest}

PREVIOUS INTERESTS:
{json.dumps(previous_interests, indent=2)}

EXISTING SKILLS:
{json.dumps(existing_skills, indent=2)}

INTEREST ANALYSIS:
{json.dumps(interest_analysis, indent=2)}

Assess the student's current evidence for EACH of the
provided skills.

Important:

- Assess only the skills provided above.
- Do not add new skills.
- Do not invent experience.
- Do not assume missing evidence means beginner.
- Use "unknown" when there is insufficient evidence.
- Every provided skill must appear exactly once.

CRITICAL ENUM RULE:

current_level describes ONLY the student's skill level.

current_level MUST be exactly one of:

    "unknown"
    "beginner"
    "developing"
    "intermediate"
    "strong"
    "advanced"

assessment_basis MUST be exactly one of:

    "evidence_based"
    "estimated"
    "unknown"

NEVER put "estimated" in current_level.

If the assessment is an estimate, use:

"current_level": one of the valid skill levels,
"assessment_basis": "estimated"

If even an approximate skill level cannot be justified, use:

"current_level": "unknown",
"assessment_basis": "unknown"

Example of a valid estimated assessment:

{{
    "skill": "Programming",
    "current_level": "developing",
    "assessment_basis": "estimated",
    "confidence": "medium",
    "evidence": "The student has related programming experience, but direct evidence for this specific skill is limited."
}}

Example of an unknown assessment:

{{
    "skill": "Game Engine Proficiency",
    "current_level": "unknown",
    "assessment_basis": "unknown",
    "confidence": "low",
    "evidence": "No evidence of experience with a game engine was provided."
}}

NEVER output:

"current_level": "estimated"

Return ONLY valid JSON.
"""

    print(
        "\n[STAGE 3] Calling OpenAI for Skill Assessment...",
        flush=True,
    )

    response = safe_chat_completion(
        messages=[
            {
                "role": "system",
                "content": SKILL_ASSESSMENT_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        max_completion_tokens=4000,
    )

    print(
        "[STAGE 3] OpenAI returned Skill Assessment response.",
        flush=True,
    )

    if not response.choices:
        raise ValueError("Stage 3 Skill Assessment: OpenAI returned no choices.")

    finish_reason = getattr(
        response.choices[0],
        "finish_reason",
        None,
    )

    content = response.choices[0].message.content

    print(
        f"[STAGE 3] Finish reason: {finish_reason}",
        flush=True,
    )

    if not content:
        raise ValueError("Stage 3 Skill Assessment: OpenAI returned empty content.")

    content = content.strip()

    if finish_reason in (
        "length",
        "max_tokens",
        "MAX_TOKENS",
    ):
        raise ValueError(
            "Stage 3 Skill Assessment was truncated "
            "because the token limit was reached."
        )

    try:
        data = parse_json_from_llm(content)

    except Exception as e:
        raise ValueError(
            "LLM did not return valid JSON for "
            "skill assessment.\n\n"
            f"Response:\n{content}"
        ) from e

    for assessment in data.get("skill_assessments", []):

        if assessment.get("current_level") == "estimated":

            assessment["current_level"] = "unknown"

            if assessment.get("assessment_basis") in (
                None,
                "unknown",
            ):
                assessment["assessment_basis"] = "estimated"

            if assessment.get("confidence") not in (
                "low",
                "medium",
                "high",
            ):
                assessment["confidence"] = "low"

    try:
        return SkillAssessmentResult.model_validate(data)

    except Exception as e:
        raise ValueError(
            "LLM output does not match "
            "SkillAssessmentResult schema.\n\n"
            f"Data:\n{data}"
        ) from e


# ============================================================
# STAGE 4 — TRANSFERABLE SKILLS
# ============================================================


def generate_transferable_skills(
    direction: str,
    required_skills: list | None = None,
    skill_assessments: list | None = None,
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    interest_analysis: dict | None = None,
) -> TransferableSkillResult:

    required_skills = required_skills or []
    skill_assessments = skill_assessments or []
    existing_skills = existing_skills or []
    previous_interests = previous_interests or []
    interest_analysis = interest_analysis or {}

    required_skills_data = [
        skill.model_dump() if hasattr(skill, "model_dump") else skill
        for skill in required_skills
    ]

    skill_assessments_data = [
        assessment.model_dump() if hasattr(assessment, "model_dump") else assessment
        for assessment in skill_assessments
    ]

    interest_analysis_data = (
        interest_analysis.model_dump()
        if hasattr(interest_analysis, "model_dump")
        else interest_analysis
    )

    user_prompt = f"""
TARGET DIRECTION:
{direction}

REQUIRED SKILLS DISCOVERED BY STAGE 2:
{json.dumps(required_skills_data, indent=2)}

CURRENT SKILL ASSESSMENTS FROM STAGE 3:
{json.dumps(skill_assessments_data, indent=2)}

EXISTING STUDENT SKILLS:
{json.dumps(existing_skills, indent=2)}

PREVIOUS INTERESTS:
{json.dumps(previous_interests, indent=2)}

INTEREST ANALYSIS:
{json.dumps(interest_analysis_data, indent=2)}

TASK:

Identify ONLY the skills from the student's existing
background that meaningfully transfer to the target direction.

Important:

1. Analyze only this direction:
   {direction}

2. Do not generate skills that the student does not possess.

3. Do not assume that every existing skill is transferable.

4. Do not copy Stage 2 required skills unless the student
   actually possesses that skill as an existing ability.

5. Do not repeat Stage 3 assessments.

6. Do not assess skill levels.

7. Do not calculate skill gaps.

8. Do not generate a roadmap.

9. Every transferable skill must be supported by evidence
   from the provided student information.

10. If there are no meaningful transferable skills, return
    an empty transferable_skills list.

Return ONLY valid JSON.
"""

    print(
        "\n[STAGE 4] Calling OpenAI for Transferable Skills...",
        flush=True,
    )

    response = safe_chat_completion(
        messages=[
            {
                "role": "system",
                "content": TRANSFERABLE_SKILL_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        max_completion_tokens=3000,
        response_format={
            "type": "json_object",
        },
    )

    print(
        "[STAGE 4] OpenAI returned Transferable Skills response.",
        flush=True,
    )

    if not response.choices:
        raise ValueError("Stage 4 Transferable Skills: " "OpenAI returned no choices.")

    finish_reason = getattr(
        response.choices[0],
        "finish_reason",
        None,
    )

    content = response.choices[0].message.content

    print(
        f"[STAGE 4] Finish reason: {finish_reason}",
        flush=True,
    )

    if not content:
        raise ValueError(
            "Stage 4 Transferable Skills: " "OpenAI returned empty content."
        )

    content = content.strip()

    if finish_reason in (
        "length",
        "max_tokens",
        "MAX_TOKENS",
    ):
        raise ValueError(
            "Stage 4 Transferable Skills was truncated "
            "because the token limit was reached."
        )
    try:
        data = parse_json_from_llm(content)

    except Exception as e:
        raise ValueError(
            "LLM did not return valid JSON for transferable "
            "skill analysis.\n\n"
            f"Response:\n{content}"
        ) from e

    try:
        return TransferableSkillResult.model_validate(data)

    except Exception as e:
        raise ValueError(
            "LLM output does not match "
            "TransferableSkillResult schema.\n\n"
            f"Data:\n{data}"
        ) from e


# ============================================================
# STAGE 5 — SKILL GAP ANALYSIS
# ============================================================


def generate_skill_gap_analysis(
    direction: str,
    required_skills: list,
    skill_assessments: list,
    transferable_skills: list,
) -> SkillGapResult:

    print(
        "\n[STAGE 5] Running deterministic Skill Gap Analysis...",
        flush=True,
    )

    # --------------------------------------------------------
    # Skill level ordering
    # --------------------------------------------------------

    LEVEL_ORDER = {
        "unknown": 0,
        "beginner": 1,
        "developing": 2,
        "intermediate": 3,
        "strong": 4,
        "advanced": 5,
    }

    # --------------------------------------------------------
    # Normalize assessment lookup
    # --------------------------------------------------------

    assessment_map = {}

    for assessment in skill_assessments:

        skill_name = assessment.skill.strip().lower()

        assessment_map[skill_name] = assessment

    # --------------------------------------------------------
    # Transferable skills lookup
    #
    # Used only as supporting context.
    # It does NOT change current_level.
    # --------------------------------------------------------

    transferable_names = {skill.skill.strip().lower() for skill in transferable_skills}

    skill_gaps = []

    # --------------------------------------------------------
    # Analyze EVERY required skill
    # --------------------------------------------------------

    for required in required_skills:

        skill_name = required.skill

        required_level = required.required_level

        assessment = assessment_map.get(skill_name.strip().lower())

        # ----------------------------------------------------
        # No assessment found
        # ----------------------------------------------------

        if assessment is None:

            current_level = "unknown"

            status = "assessment_needed"

            explanation = (
                "No current assessment evidence is available "
                "for this skill, so the student's level cannot "
                "be reliably determined."
            )

        else:

            current_level = assessment.current_level

            # ------------------------------------------------
            # UNKNOWN
            # ------------------------------------------------

            if current_level == "unknown":

                status = "assessment_needed"

                explanation = (
                    "The student's current level could not be "
                    "established from the available evidence. "
                    "Additional assessment is needed before "
                    "classifying this as a confirmed skill gap."
                )

            else:

                current_score = LEVEL_ORDER[current_level]
                required_score = LEVEL_ORDER[required_level]

                # --------------------------------------------
                # REQUIREMENT MET
                # --------------------------------------------

                if current_score >= required_score:

                    status = "no_gap"

                    explanation = (
                        f"The assessed level is "
                        f"{current_level}, which meets or "
                        f"exceeds the required level of "
                        f"{required_level}."
                    )

                # --------------------------------------------
                # ONE LEVEL BELOW
                # --------------------------------------------

                elif required_score - current_score == 1:

                    status = "small_gap"

                    explanation = (
                        f"The assessed level is "
                        f"{current_level}, one level below "
                        f"the required {required_level} level. "
                        f"This indicates a relatively small "
                        f"development gap."
                    )

                # --------------------------------------------
                # SUBSTANTIAL GAP
                # --------------------------------------------

                else:

                    status = "actual_gap"

                    explanation = (
                        f"The assessed level is "
                        f"{current_level}, substantially below "
                        f"the required {required_level} level. "
                        f"This skill should be prioritized for "
                        f"development."
                    )

        # ----------------------------------------------------
        # Add transferable context
        # ----------------------------------------------------

        if skill_name.strip().lower() in transferable_names and status != "no_gap":

            explanation += (
                " Related transferable experience may provide "
                "a useful foundation for developing this skill."
            )

        # ----------------------------------------------------
        # Create validated result
        # ----------------------------------------------------

        skill_gaps.append(
            {
                "skill": skill_name,
                "current_level": current_level,
                "required_level": required_level,
                "status": status,
                "explanation": explanation,
            }
        )

    # --------------------------------------------------------
    # Final result
    # --------------------------------------------------------

    result = SkillGapResult(
        direction=direction,
        skill_gaps=skill_gaps,
    )

    print(
        f"[STAGE 5] Completed deterministic Skill Gap Analysis. "
        f"Skills analyzed: {len(skill_gaps)}",
        flush=True,
    )

    return result


# ============================================================
# STAGE 6 — TRANSITION DIFFICULTY + ROADMAP
# ============================================================


def generate_transition_roadmap(
    direction: str,
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    required_skills: list | None = None,
    skill_assessments: list | None = None,
    transferable_skills: list | None = None,
    skill_gaps: list | None = None,
) -> TransitionRoadmapResult:

    existing_skills = existing_skills or []
    previous_interests = previous_interests or []
    required_skills = required_skills or []
    skill_assessments = skill_assessments or []
    transferable_skills = transferable_skills or []
    skill_gaps = skill_gaps or []

    user_prompt = f"""
TARGET DIRECTION
----------------
{direction}

EXISTING STUDENT SKILLS
----------------------
{json.dumps(existing_skills, indent=2)}

PREVIOUS INTERESTS
------------------
{json.dumps(previous_interests, indent=2)}

REQUIRED SKILLS FROM STAGE 2
----------------------------
{json.dumps(
    [
        skill.model_dump()
        if hasattr(skill, "model_dump")
        else skill
        for skill in required_skills
    ],
    indent=2,
)}

CURRENT SKILL ASSESSMENTS FROM STAGE 3
--------------------------------------
{json.dumps(
    [
        assessment.model_dump()
        if hasattr(assessment, "model_dump")
        else assessment
        for assessment in skill_assessments
    ],
    indent=2,
)}

TRANSFERABLE SKILLS FROM STAGE 4
--------------------------------
{json.dumps(
    [
        skill.model_dump()
        if hasattr(skill, "model_dump")
        else skill
        for skill in transferable_skills
    ],
    indent=2,
)}

SKILL GAPS FROM STAGE 5
-----------------------
{json.dumps(
    [
        gap.model_dump()
        if hasattr(gap, "model_dump")
        else gap
        for gap in skill_gaps
    ],
    indent=2,
)}

TASK
----
Determine the transition difficulty for this direction and
create a practical transition roadmap.

Use only the information provided above.

Return ONLY valid JSON.
"""

    print(
        "\n[STAGE 6] Calling OpenAI for Transition Roadmap...",
        flush=True,
    )

    response = safe_chat_completion(
        model=SKILL_GAP_MODEL,
        reasoning_effort="none",
        messages=[
            {
                "role": "system",
                "content": TRANSITION_ROADMAP_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        max_completion_tokens=4000,
        response_format={
            "type": "json_object",
        },
    )

    print(
        "[STAGE 6] OpenAI returned Transition Roadmap response.",
        flush=True,
    )

    if not response.choices:
        raise ValueError("Stage 6 Transition Roadmap: " "OpenAI returned no choices.")

    finish_reason = getattr(
        response.choices[0],
        "finish_reason",
        None,
    )

    content = response.choices[0].message.content

    print(
        f"[STAGE 6] Finish reason: {finish_reason}",
        flush=True,
    )

    if not content:
        raise ValueError(
            "Stage 6 Transition Roadmap: " "OpenAI returned empty content."
        )

    content = content.strip()

    if finish_reason in (
        "length",
        "max_tokens",
        "MAX_TOKENS",
    ):
        raise ValueError(
            "Stage 6 Transition Roadmap was truncated "
            "because the token limit was reached."
        )

    try:
        data = parse_json_from_llm(content)

    except Exception as e:
        raise ValueError(
            "LLM did not return valid JSON for transition roadmap.\n\n"
            f"Response:\n{content}"
        ) from e

    try:
        return TransitionRoadmapResult.model_validate(data)

    except Exception as e:
        raise ValueError(
            "LLM output does not match "
            "TransitionRoadmapResult schema.\n\n"
            f"Data:\n{data}"
        ) from e
