"""Small curated set of official entry-point links for career-path guidance.

These links point to official recruitment/admissions portals. They do not
replace the current notification or programme rules, and are not a live vacancy
feed. Never infer a deadline or eligibility condition from the portal URL alone.
"""

from __future__ import annotations

import re

CAREER_PATH_VERSION = "career_role_routes_v4"


def get_official_resources_for_direction(direction_name: str) -> list[dict[str, str]]:
    name = (direction_name or "").strip().lower()
    resources: list[dict[str, str]] = []

    def add(label: str, url: str, description: str) -> None:
        if not any(item["url"] == url for item in resources):
            resources.append({"label": label, "url": url, "description": description})

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

    if any(
        term in name
        for term in (
            "ssc",
            "staff selection",
            "central government",
            "section officer",
            "income tax inspector",
        )
    ):
        add(
            "Staff Selection Commission",
            "https://ssc.gov.in/",
            "Official SSC recruitment notices, exam calendars, and candidate updates. Post-specific criteria vary.",
        )

    if any(
        term in name
        for term in (
            "state public service",
            "state civil service",
            "state services",
            "mpsc",
            "state psc",
        )
    ):
        if "maharashtra" in name or "mpsc" in name:
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

    if any(
        term in name
        for term in (
            "public policy",
            "policy analyst",
            "policy research",
            "governance",
            "public administration",
        )
    ):
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


_ACTIVITY_PREFIX = re.compile(
    r"^(pursue|participate|build|improve|learn|practice|practise|take part in|"
    r"engage in|create|start|begin|complete|volunteer|organize|organise|"
    r"prepare for|study|explore|work on|join|run|conduct|develop|strengthen|"
    r"level up)\b",
    re.IGNORECASE,
)

_ACTIVITY_PHRASES = (
    "initiative organizing",
    "initiative organising",
    "learning projects",
    "project plan",
    "outreach practice",
    "communication drills",
    "follow-through system",
    "accountability tracker",
    "mini-plan",
    "skill development",
)

_NON_ROLE_TITLE_PHRASES = (
    "examination",
    " exam",
    "degree",
    "master of",
    "bachelor of",
    "postgraduate diploma",
    "course",
    "certification",
    "learning path",
    "training program",
    "training programme",
)

_ROLE_TERMS = (
    "officer",
    "analyst",
    "engineer",
    "developer",
    "scientist",
    "researcher",
    "research associate",
    "policy associate",
    "programme officer",
    "program officer",
    "coordinator",
    "administrator",
    "specialist",
    "manager",
    "executive",
    "inspector",
    "auditor",
    "clerk",
    "assistant",
    "consultant",
    "designer",
    "teacher",
    "lecturer",
    "professor",
    "nurse",
    "doctor",
    "lawyer",
    "advocate",
    "accountant",
    "technician",
    "economist",
    "planner",
    "journalist",
    "editor",
    "worker",
    "professional",
    "recruitment",
    "group b",
    "group c",
    "civil services",
    "civil service",
    "administrative service",
    "foreign service",
    "police service",
    "forest service",
    "state services",
    "public service officer",
    "social worker",
    "scientific officer",
    "technical officer",
    "commissioned officer",
)


def is_career_role_name(value: str) -> bool:
    """Reject activity/learning-plan titles before they become career options.

    This is a conservative title sanity check, not a full occupation database.
    It catches obvious activity-like output and requires a recognizable role
    or occupational-family term. A failed title is retried once, then omitted.
    """
    name = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    if not name or _ACTIVITY_PREFIX.search(name):
        return False
    if any(phrase in name for phrase in _ACTIVITY_PHRASES):
        return False
    if any(phrase in name for phrase in _NON_ROLE_TITLE_PHRASES):
        return False
    title = name.split("(", 1)[0].strip()
    return any(term in title for term in _ROLE_TERMS)
