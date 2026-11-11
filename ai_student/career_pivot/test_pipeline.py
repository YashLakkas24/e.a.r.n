from ai_student.career_pivot import pipeline
from ai_student.career_pivot.schemas import Direction, DirectionDiscoveryResult


def test_discover_career_directions_prioritizes_feasibility_and_fit():
    directions = DirectionDiscoveryResult(
        directions=[
            Direction(
                name="Not currently accessible",
                fit_score=99,
                reason="High interest fit",
                feasibility_status="not_possible",
                feasibility_reason="Known requirement conflict",
            ),
            Direction(
                name="Needs preparation",
                fit_score=95,
                reason="High interest fit",
                feasibility_status="needs_preparation",
                feasibility_reason="Requires a qualification first",
            ),
            Direction(
                name="Feasible, lower fit",
                fit_score=55,
                reason="Some interest fit",
                feasibility_status="feasible",
                feasibility_reason="Meets baseline requirements",
            ),
            Direction(
                name="Eligibility unknown",
                fit_score=100,
                reason="High interest fit",
                feasibility_status="eligibility_unconfirmed",
                feasibility_reason="A requirement needs verification",
            ),
            Direction(
                name="Feasible, higher fit",
                fit_score=80,
                reason="Strong interest fit",
                feasibility_status="feasible",
                feasibility_reason="Meets baseline requirements",
            ),
        ]
    )
    original_discovery = pipeline.generate_direction_discovery
    pipeline.generate_direction_discovery = lambda **kwargs: directions

    try:
        result = pipeline.discover_career_directions(
            interest_analysis={"interest": "Government & public services"}
        )

        assert [direction.name for direction in result.directions] == [
            "Feasible, higher fit",
            "Feasible, lower fit",
            "Needs preparation",
            "Eligibility unknown",
            "Not currently accessible",
        ]
    finally:
        pipeline.generate_direction_discovery = original_discovery


if __name__ == "__main__":
    test_discover_career_directions_prioritizes_feasibility_and_fit()
