"""Small curated set of official entry-point links for career-path guidance.

These links point to official recruitment/admissions portals. They do not
replace the current notification or programme rules, and are not a live vacancy
feed. Never infer a deadline or eligibility condition from the portal URL alone.
"""

from __future__ import annotations


CAREER_STATUS_ORDER = {
    "possible_now": 0,
    "possible_after_graduation": 1,
    "additional_qualification_required": 2,
    "needs_more_information": 3,
    "not_possible": 4,
}


def get_official_resources_for_direction(
    direction_name: str,
    state_or_ut: str | None = None,
) -> list[dict[str, str]]:
    name = (direction_name or "").strip().lower()
    state = (state_or_ut or "").strip().lower()
    resources: list[dict[str, str]] = []

    def add(label: str, url: str, description: str) -> None:
        if not any(item["url"] == url for item in resources):
            resources.append(
                {"label": label, "url": url, "description": description}
            )

    # Official public-sector job-discovery portal.
    if any(
        term in name
        for term in (
            "government",
            "public service",
            "public sector",
            "civil service",
            "policy",
            "public policy",
            "public affairs",
            "community program",
            "programme coordinator",
            "municipal",
            "civic",
            "administration",
            "governance",
            "social sector",
        )
    ):
        add(
            "National Career Service — Government Job Vacancies",
            "https://www.ncs.gov.in/pages/govt-job-vacancies.aspx",
            "Government recruitment portals listed by India's National Career Service. Check the recruiting department's own notice.",
        )

    if any(
        term in name
        for term in (
            "upsc",
            "civil service",
            "indian administrative service",
            "indian foreign service",
            "indian police service",
            "indian forest service",
            "ias",
            "ips",
            "ifs",
            "ifos",
            "irs",
        )
    ):
        add(
            "UPSC Civil Services Examination 2026 — Official Notification",
            "https://www.upsc.gov.in/sites/default/files/Notif-CSP-2026-Engl-060226Rev.pdf",
            "Official 2026 notice for the exam structure and eligibility rules. The 2026 application period is over; check the next cycle's notice before applying.",
        )
        add(
            "UPSC — Active Examinations",
            "https://www.upsc.gov.in/examinations/active-exams",
            "Official UPSC examination pages and notifications. Verify qualification, age, attempts, and dates in the relevant year's notice.",
        )
        add(
            "UPSC Online Application Portal",
            "https://upsconline.nic.in",
            "Official application portal. Apply only when the relevant examination's application window is open.",
        )
        add(
            "UPSC — Examination Notifications",
            "https://www.upsc.gov.in/exams-related-info/exam-notification",
            "Official exam notices and notification documents.",
        )

    if any(term in name for term in ("ssc", "staff selection", "central government", "section officer", "income tax inspector")):
        add(
            "Staff Selection Commission",
            "https://ssc.gov.in/",
            "Official SSC recruitment notices, exam calendars, and candidate updates. Post-specific criteria vary.",
        )

    if any(term in name for term in ("state public service", "state civil service", "mpsc", "state psc")):
        if "maharashtra" in state or "maharashtra" in name or "mpsc" in name:
            add(
                "Maharashtra Public Service Commission — Official Notices",
                "https://mpsc.gov.in/announcement_and_circular/true",
                "Official MPSC announcements and circulars. Check the specific recruitment advertisement for current dates and eligibility.",
            )
            add(
                "MPSC Online Application Portal",
                "https://mpsconline.gov.in/candidate",
                "Official online candidate portal. Applications are accepted only during the window stated in the relevant notice.",
            )
        else:
            add(
                "National Career Service — Government Job Vacancies",
                "https://www.ncs.gov.in/pages/govt-job-vacancies.aspx",
                "Use this government directory to identify recruitment portals; state PSC eligibility must be checked on the relevant state commission site.",
            )

    if any(term in name for term in ("public policy", "policy analyst", "policy research", "governance", "public administration")):
        add(
            "NLSIU — Master of Public Policy",
            "https://www.nls.ac.in/programme/master-of-public-policy/",
            "An official example of a public-policy higher-education route; this is one programme, not a universal requirement.",
        )
        add(
            "Dr. B. R. Ambedkar University Delhi — MA Public Policy & Governance",
            "https://aud.delhi.gov.in/ma-public-policy-governance",
            "Official programme and admission information for one public-policy pathway. Check the current cycle's criteria.",
        )

    if not resources:
        add(
            "National Career Service — Job Search and Career Support",
            "https://www.ncs.gov.in/",
            "Official employment and career-support portal. Search current job postings and job fairs; this link does not imply that a specific vacancy is open.",
        )

    return resources


def enforce_verified_eligibility(direction, student_profile: dict | None = None) -> None:
    """Prevent unsupported hard-ineligibility labels.

    The initial curated rule set can verify the Indian-citizenship requirement
    for IAS/IFS/IPS. Other model-generated "not_possible" judgments remain
    unresolved until a path-specific, authoritative rule has been encoded.
    """
    profile = student_profile or {}
    name = (getattr(direction, "name", "") or "").strip().lower()
    citizenship = profile.get("citizenship_status", "unknown")

    is_ias = "indian administrative service" in name or name == "ias"
    is_ifs = "indian foreign service" in name
    is_ips = "indian police service" in name or name == "ips"
    has_verified_citizenship_barrier = (
        citizenship == "other_citizenship" and (is_ias or is_ifs or is_ips)
    )

    if has_verified_citizenship_barrier:
        direction.eligibility_status = "not_possible"
        direction.eligibility_reason = (
            "The UPSC Civil Services Examination 2026 notice requires Indian "
            "citizenship for the Indian Administrative Service, Indian Foreign "
            "Service, and Indian Police Service. Your profile says you are not "
            "an Indian citizen. This is a route-specific preliminary finding; "
            "verify the latest notice and consider other services/pathways."
        )
        direction.missing_information = []
        return

    # Conservative age rule for the IAS/IFS/IPS route: under the latest
    # available CSE 2026 notice, the standard age range is 21–32 on 1 Aug 2026.
    # If the student explicitly reports no applicable relaxation and is at
    # least 34 now (so over the upper limit even on that earlier cutoff date),
    # this route is not eligible under that notice. Later examination rules can
    # change, so the reason must name the cycle and link the official notice.
    age = profile.get("age")
    no_relaxation = profile.get("age_or_marks_relaxation") == "no"
    if (
        (is_ias or is_ifs or is_ips)
        and isinstance(age, int)
        and age >= 34
        and no_relaxation
    ):
        direction.eligibility_status = "not_possible"
        direction.eligibility_reason = (
            "Under the latest available UPSC Civil Services Examination 2026 "
            "notice, the standard age limit was 21–32 as of 1 August 2026. "
            "Your stated age and indication that no age relaxation applies "
            "put you above that limit for this notice. This is not a permanent "
            "career judgment; recheck the eligibility rules for any later cycle."
        )
        direction.missing_information = []
        return

    if getattr(direction, "eligibility_status", "") == "not_possible":
        direction.eligibility_status = "needs_more_information"
        missing = list(getattr(direction, "missing_information", []) or [])
        missing.append("verified role-specific eligibility rule")
        direction.missing_information = list(dict.fromkeys(missing))
        direction.eligibility_reason = (
            "E.A.R.N. could not verify a hard eligibility barrier from its "
            "current rule set. Check the latest official recruitment or "
            "admissions notice before ruling this path out."
        )


def eligibility_sort_key(direction: dict) -> tuple[int, int]:
    """Put actionable paths first and hard-ineligible paths last."""
    status = direction.get("eligibility_status", "needs_more_information")
    fit = direction.get("fit_score") or 0
    return (CAREER_STATUS_ORDER.get(status, 3), -int(fit))
