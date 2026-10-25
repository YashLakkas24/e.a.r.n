from datetime import date


def calculate_priority(notice: dict) -> dict:

    if notice.get("is_mandatory"):
        base_priority = "CRITICAL"

    else:
        base_priority = str(notice.get("importance") or "NORMAL").upper()

    deadline = notice.get("deadline")
    days_left = None

    if deadline:

        try:

            if isinstance(deadline, date):
                deadline_date = deadline
            else:
                deadline_date = date.fromisoformat(str(deadline)[:10])
            days_left = (deadline_date - date.today()).days

        except (ValueError, TypeError):

            days_left = None

    # Expired
    if days_left is not None and days_left < 0:

        return {
            "priority": "EXPIRED",
            "urgency": "EXPIRED",
            "days_left": days_left,
        }

    # Due today/tomorrow
    if days_left is not None and days_left <= 1:

        return {
            "priority": "CRITICAL",
            "urgency": "URGENT",
            "days_left": days_left,
        }

    # Due within 3 days
    if days_left is not None and days_left <= 3:

        return {
            "priority": (
                "CRITICAL" if base_priority in ["CRITICAL", "HIGH"] else "HIGH"
            ),
            "urgency": "URGENT",
            "days_left": days_left,
        }

    # Due within a week
    if days_left is not None and days_left <= 7:

        return {
            "priority": ("HIGH" if base_priority in ["CRITICAL", "HIGH"] else "NORMAL"),
            "urgency": "SOON",
            "days_left": days_left,
        }

    return {
        "priority": base_priority,
        "urgency": "NORMAL",
        "days_left": days_left,
    }
