from typing import Dict, Any

# Canonical branch names used internally by the eligibility engine.
BRANCH_ALIASES = {
    # Artificial Intelligence & Data Science
    "AI&DS": "AIDS",
    "AI & DS": "AIDS",
    "AI DS": "AIDS",
    "AIDS": "AIDS",
    "ARTIFICIAL INTELLIGENCE & DATA SCIENCE": "AIDS",
    "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE": "AIDS",
    # Computer Science & Engineering
    "CSE": "CSE",
    "COMPUTER SCIENCE & ENGINEERING": "CSE",
    "COMPUTER SCIENCE AND ENGINEERING": "CSE",
    # Information Technology
    "IT": "IT",
    "INFORMATION TECHNOLOGY": "IT",
    # Electronics & Telecommunication
    "EXTC": "EXTC",
    "E&TC": "EXTC",
    "E & TC": "EXTC",
    "ELECTRONICS & TELECOMMUNICATION": "EXTC",
    "ELECTRONICS AND TELECOMMUNICATION": "EXTC",
    # Electronics & Computer Engineering
    "ECE": "ECE",
    "ELECTRONICS & COMPUTER ENGINEERING": "ECE",
    "ELECTRONICS AND COMPUTER ENGINEERING": "ECE",
    # Mechanical Engineering
    "MECH": "MECH",
    "ME": "MECH",
    "MECHANICAL ENGINEERING": "MECH",
    # Civil Engineering
    "CIVIL": "CIVIL",
    "CE": "CIVIL",
    "CIVIL ENGINEERING": "CIVIL",
    # Electrical Engineering
    "EE": "EE",
    "ELECTRICAL ENGINEERING": "EE",
}


def normalize_branch(branch: Any) -> str:
    """
    Convert a branch name into a canonical internal representation.

    Known aliases are mapped to canonical branch codes.
    Unknown branches fall back to normalized text so that
    eligibility remains fail-safe and deterministic.
    """
    branch = str(branch or "").strip().upper()

    if not branch:
        return ""

    if branch in BRANCH_ALIASES:
        return BRANCH_ALIASES[branch]

    normalized = branch.replace("-", " ").replace("_", " ").replace(" ", " ").strip()

    return BRANCH_ALIASES.get(normalized, normalized)


def check_eligibility(
    student: Dict[str, Any], notice: Dict[str, Any]
) -> Dict[str, Any]:

    eligibility = notice.get("eligibility", {})

    eligible_years = eligibility.get("years") or []
    eligible_branches = eligibility.get("branches") or ["ALL"]

    student_year = student.get("year")
    student_branch = normalize_branch(student.get("branch"))

    # -------------------------
    # Branch eligibility
    # -------------------------

    normalized_branches = [normalize_branch(branch) for branch in eligible_branches]

    # Empty / ALL = no restriction
    year_match = not eligible_years or student_year in eligible_years

    branch_match = (
        not normalized_branches
        or "ALL" in normalized_branches
        or student_branch in normalized_branches
    )

    eligible = year_match and branch_match

    reasons = []

    if not year_match:
        reasons.append(f"Student year {student_year} is not eligible.")

    if not branch_match:
        reasons.append(f"Student branch {student_branch} is not eligible.")

    if eligible:
        reasons.append("Student satisfies the stated eligibility criteria.")

    return {
        "eligible": eligible,
        "year_match": year_match,
        "branch_match": branch_match,
        "reasons": reasons,
    }
