import unittest

from ai_student.career_pivot.pathway_sources import (
    eligibility_sort_key,
    is_career_role_name,
)


class CareerPathTitleTests(unittest.TestCase):
    def test_rejects_activity_like_titles(self):
        rejected = [
            "Civic initiative organizing (planning, outreach, coordination, follow-through)",
            "Policy learning projects",
            "Pursue additional internships or clerkships",
            "Master of Public Policy",
            "SSC CGL Examination",
        ]
        for title in rejected:
            with self.subTest(title=title):
                self.assertFalse(is_career_role_name(title))

    def test_accepts_recognizable_roles_and_role_families(self):
        accepted = [
            "Indian Administrative Service (IAS)",
            "State Civil Services Officer (MPSC State Services route)",
            "Central Government Group B/C Posts (SSC CGL route)",
            "Public Policy Analyst",
            "Community Development Programme Officer",
            "Python Backend Developer",
            "Project Manager",
        ]
        for title in accepted:
            with self.subTest(title=title):
                self.assertTrue(is_career_role_name(title))

    def test_verified_ineligible_paths_sort_after_actionable_paths(self):
        possible = eligibility_sort_key(
            {"eligibility_status": "possible_after_graduation", "fit_score": 45}
        )
        blocked = eligibility_sort_key(
            {"eligibility_status": "not_possible", "fit_score": 99}
        )
        self.assertLess(possible, blocked)


if __name__ == "__main__":
    unittest.main()
