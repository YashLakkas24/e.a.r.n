import unittest

from ai_student.career_pivot.pathway_sources import (
    is_career_role_name,
    get_official_resources_for_direction,
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



class OfficialCareerResourceTests(unittest.TestCase):
    def test_mpsc_role_includes_official_mpsc_portal(self):
        resources = get_official_resources_for_direction(
            "MPSC State Civil Services Officer"
        )
        urls = {item["url"] for item in resources}
        self.assertIn("https://mpsc.gov.in/announcement_and_circular/true", urls)
        self.assertIn("https://mpsconline.gov.in/candidate", urls)


if __name__ == "__main__":
    unittest.main()
