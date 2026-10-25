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

    if any(term in name for term in ("upsc", "civil service", "ias", "ips", "ifs", "irs")):
        add(
            "UPSC — Active Examinations",
            "https://www.upsc.gov.in/examinations/active-exams",
            "Official UPSC examination pages and notifications. Verify qualification, age, attempts, and dates in the relevant year's notice.",
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
                "Maharashtra Public Service Commission — Online Application System",
                "https://revenue.mahaonline.gov.in/MPSC/MPSCHome.aspx",
                "Official Maharashtra PSC application portal. Verify the relevant advertisement and post-specific criteria.",
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


def eligibility_sort_key(direction: dict) -> tuple[int, int]:
    """Put actionable paths first and hard-ineligible paths last."""
    status = direction.get("eligibility_status", "needs_more_information")
    fit = direction.get("fit_score") or 0
    return (CAREER_STATUS_ORDER.get(status, 3), -int(fit))
