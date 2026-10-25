from ai_student.llm.service import (
    generate_direction_discovery,
    generate_skill_discovery,
    generate_skill_assessment,
    generate_transferable_skills,
    generate_skill_gap_analysis,
    generate_transition_roadmap,
)

from ai_student.career_pivot.pathway_sources import (
    eligibility_sort_key,
    get_official_resources_for_direction,
)

from time import perf_counter

from ai_student.career_pivot.schemas import (
    DirectionDiscoveryResult,
    CareerResource,
    CareerSkillGapAnalysis,
    CareerDirectionAnalysis,
    TransitionRoadmapResult,
)


# ============================================================
# STAGE 1 — DISCOVER CAREER DIRECTIONS
# ============================================================

def discover_career_directions(
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    interest_analysis: dict | None = None,
    student_profile: dict | None = None,
) -> DirectionDiscoveryResult:

    existing_skills = existing_skills or []
    previous_interests = previous_interests or []
    interest_analysis = interest_analysis or {}
    student_profile = student_profile or {}

    interest = interest_analysis.get("interest", "")

    print("\n" + "=" * 60)
    print("CAREER DIRECTION DISCOVERY")
    print("=" * 60)

    # ========================================================
    # Generate career directions
    # ========================================================

    direction_result = generate_direction_discovery(
        interest=interest,
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        interest_analysis=interest_analysis,
        student_profile=student_profile,
    )

    # Add official entry portals deterministically; the model is not allowed
    # to invent source URLs. Apply a final conservative guard before showing
    # "NOT POSSIBLE": a hard negative decision needs the profile facts that
    # materially affect the chosen route.
    for direction in direction_result.directions:
        if not direction.pathway_summary:
            direction.pathway_summary = (
                "Confirm the formal qualifications and entry procedure in the "
                "relevant official recruitment or admissions notice."
            )
        if not direction.eligibility_reason:
            direction.eligibility_reason = (
                "This is a preliminary fit assessment. Verify role-specific "
                "eligibility in the official source before deciding."
            )
        direction.official_resources = [
            CareerResource.model_validate(resource)
            for resource in get_official_resources_for_direction(
                direction.name,
                student_profile.get("state_or_ut"),
            )
        ]

        if direction.eligibility_status == "not_possible":
            role_text = direction.name.lower()
            route_is_government_or_exam = direction.pathway_type in (
                "competitive_exam", "direct_recruitment", "mixed"
            ) or any(
                term in role_text
                for term in ("civil service", "government", "public service", "upsc", "ssc", "psc")
            )
            missing_facts = list(direction.missing_information or [])

            if student_profile.get("highest_qualification") in (None, "", "unknown"):
                missing_facts.append("highest completed qualification")
            if student_profile.get("education_status") in (None, "", "unknown"):
                missing_facts.append("whether you are currently studying or have completed your qualification")
            if route_is_government_or_exam:
                if student_profile.get("age") in (None, ""):
                    missing_facts.append("age (where age limits apply)")
                if student_profile.get("citizenship_status") in (None, "", "unknown"):
                    missing_facts.append("citizenship status (where applicable)")

            reason_text = (direction.eligibility_reason or "").lower()
            if (
                ("age" in reason_text or "marks" in reason_text or "relaxation" in reason_text)
                and student_profile.get("age_or_marks_relaxation", "unknown") == "unknown"
            ):
                missing_facts.append("whether an age/marks relaxation could apply")

            if missing_facts:
                direction.eligibility_status = "needs_more_information"
                direction.missing_information = list(dict.fromkeys(missing_facts))
                direction.eligibility_reason = (
                    "E.A.R.N. cannot safely mark this route as NOT POSSIBLE "
                    "until these eligibility facts are confirmed."
                )

    direction_result.directions.sort(key=lambda item: eligibility_sort_key(item.model_dump()))

    # ========================================================
    # Safety guard
    #
    # The prompt should ask Gemini for 5 directions.
    # This prevents accidentally processing more than 5.
    # ========================================================

    direction_result.directions = direction_result.directions[:5]

    print("\nDISCOVERED DIRECTIONS:")

    for index, direction in enumerate(
        direction_result.directions,
        start=1,
    ):
        print(
            f"{index}. {direction.name} "
            f"(fit: {direction.fit_score})"
        )

    return direction_result


# ============================================================
# STAGES 2–6 — ANALYZE ONLY THE SELECTED DIRECTION
# ============================================================

def analyze_selected_skills(
    selected_direction: str,
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    interest_analysis: dict | None = None,
) -> CareerSkillGapAnalysis:
    """Generate only the data required by the Skill Gaps page.

    Roadmap generation is kept separate so the frontend can display
    skill-gap results without waiting for the additional roadmap LLM call.
    """
    existing_skills = existing_skills or []
    previous_interests = previous_interests or []
    interest_analysis = interest_analysis or {}
    interest = interest_analysis.get("interest", "")
    selected_direction = selected_direction.strip()

    if not selected_direction:
        raise ValueError("Selected direction cannot be empty.")

    print("\n" + "=" * 60, flush=True)
    print(f"SKILL GAP ANALYSIS: {selected_direction}", flush=True)
    print("=" * 60, flush=True)

    stage_started = perf_counter()
    skill_result = generate_skill_discovery(
        interest=interest,
        direction=selected_direction,
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        interest_analysis=interest_analysis,
    )
    print(
        f"[CAREER PIVOT TIMING] Skill discovery completed in "
        f"{perf_counter() - stage_started:.2f}s",
        flush=True,
    )

    stage_started = perf_counter()
    assessment_result = generate_skill_assessment(
        direction=selected_direction,
        skills=[skill.skill for skill in skill_result.skills],
        interest=interest,
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        interest_analysis=interest_analysis,
    )
    print(
        f"[CAREER PIVOT TIMING] Skill assessment completed in "
        f"{perf_counter() - stage_started:.2f}s",
        flush=True,
    )

    stage_started = perf_counter()
    transferable_result = generate_transferable_skills(
        direction=selected_direction,
        required_skills=skill_result.skills,
        skill_assessments=assessment_result.skill_assessments,
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        interest_analysis=interest_analysis,
    )
    print(
        f"[CAREER PIVOT TIMING] Transferable-skill analysis completed in "
        f"{perf_counter() - stage_started:.2f}s",
        flush=True,
    )

    stage_started = perf_counter()
    skill_gap_result = generate_skill_gap_analysis(
        direction=selected_direction,
        required_skills=skill_result.skills,
        skill_assessments=assessment_result.skill_assessments,
        transferable_skills=transferable_result.transferable_skills,
    )
    print(
        f"[CAREER PIVOT TIMING] Deterministic gap calculation completed in "
        f"{perf_counter() - stage_started:.2f}s",
        flush=True,
    )

    result = CareerSkillGapAnalysis(
        direction=selected_direction,
        required_skills=skill_result.skills,
        skill_assessments=assessment_result.skill_assessments,
        transferable_skills=transferable_result.transferable_skills,
        skill_gaps=skill_gap_result.skill_gaps,
    )
    print(
        f"[CAREER PIVOT] Skill-gap data ready for '{selected_direction}' "
        f"({len(result.skill_gaps)} skills).",
        flush=True,
    )
    return result


def generate_roadmap_for_skill_analysis(
    skill_analysis: CareerSkillGapAnalysis,
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    student_profile: dict | None = None,
) -> TransitionRoadmapResult:
    """Generate the career-entry roadmap separately, on demand."""
    existing_skills = existing_skills or []
    previous_interests = previous_interests or []
    student_profile = student_profile or {}
    official_resources = get_official_resources_for_direction(
        skill_analysis.direction,
        student_profile.get("state_or_ut"),
    )

    stage_started = perf_counter()
    result = generate_transition_roadmap(
        direction=skill_analysis.direction,
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        required_skills=skill_analysis.required_skills,
        skill_assessments=skill_analysis.skill_assessments,
        transferable_skills=skill_analysis.transferable_skills,
        skill_gaps=skill_analysis.skill_gaps,
        student_profile=student_profile,
        official_resources=official_resources,
    )
    print(
        f"[CAREER PIVOT TIMING] Roadmap generation completed in "
        f"{perf_counter() - stage_started:.2f}s",
        flush=True,
    )
    return result


def analyze_selected_direction(
    selected_direction: str,
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    interest_analysis: dict | None = None,
) -> CareerDirectionAnalysis:
    """Backward-compatible full analysis, including the roadmap."""
    existing_skills = existing_skills or []
    previous_interests = previous_interests or []
    interest_analysis = interest_analysis or {}

    skill_analysis = analyze_selected_skills(
        selected_direction=selected_direction,
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        interest_analysis=interest_analysis,
    )
    roadmap_result = generate_roadmap_for_skill_analysis(
        skill_analysis=skill_analysis,
        existing_skills=existing_skills,
        previous_interests=previous_interests,
    )

    return CareerDirectionAnalysis(
        direction=skill_analysis.direction,
        required_skills=skill_analysis.required_skills,
        skill_assessments=skill_analysis.skill_assessments,
        transferable_skills=skill_analysis.transferable_skills,
        skill_gaps=skill_analysis.skill_gaps,
        transition_difficulty=roadmap_result.transition_difficulty,
        transition_reason=roadmap_result.transition_reason,
        roadmap=roadmap_result.roadmap,
    )


# ============================================================
# BACKWARD-COMPATIBILITY WRAPPER
# ============================================================

def run_career_pivot_pipeline(
    existing_skills: list[str] | None = None,
    previous_interests: list[str] | None = None,
    interest_analysis: dict | None = None,
):
    """
    Backward-compatible wrapper.

    This now performs ONLY direction discovery.

    It does NOT analyze every direction.

    After the student selects one direction,
    call analyze_selected_direction().
    """

    return discover_career_directions(
        existing_skills=existing_skills,
        previous_interests=previous_interests,
        interest_analysis=interest_analysis,
    )