import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Code2,
  Compass,
  Gamepad2,
  GraduationCap,
  Map,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { getStudentCareerDirections } from "../../services/studentService";
import "./CareerPathExplorer.css";

function getStudentId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.student_id || user.user_id || "";
  } catch {
    return "";
  }
}

const ELIGIBILITY_META = {
  possible_now: {
    label: "Possible now",
    className: "eligibility-possible-now",
    Icon: CheckCircle2,
    detail:
      "Available information suggests this route may be accessible. Verify the latest official requirements before applying.",
  },
  possible_after_graduation: {
    label: "Possible after graduation",
    className: "eligibility-after-graduation",
    Icon: GraduationCap,
    detail:
      "This route may become available after the stated qualification milestone. Verify the current entry requirements.",
  },
  additional_qualification_required: {
    label: "Further qualification required",
    className: "eligibility-additional-qualification",
    Icon: CalendarClock,
    detail:
      "This route appears to require further education, certification, or another prerequisite before entry.",
  },
  needs_more_information: {
    label: "Eligibility not assessed",
    className: "eligibility-needs-information",
    Icon: CircleHelp,
    detail:
      "Career relevance is based on your Interest+ profile. Personal entry eligibility must be checked against the current official requirements.",
  },
  not_possible: {
    label: "NOT POSSIBLE",
    className: "eligibility-not-possible",
    Icon: AlertTriangle,
    detail:
      "A known eligibility barrier appears to block this route under the supplied profile. Check the linked official rules before ruling it out.",
  },
};

const STATUS_ORDER = {
  possible_now: 0,
  possible_after_graduation: 1,
  additional_qualification_required: 2,
  needs_more_information: 3,
  not_possible: 4,
};

function getPathIcon(directionName) {
  const name = String(directionName || "").toLowerCase();

  if (
    name.includes("machine learning") ||
    name.includes("artificial intelligence") ||
    name.startsWith("ai ")
  ) {
    return BrainCircuit;
  }
  if (name.includes("game") || name.includes("gameplay")) return Gamepad2;
  if (
    name.includes("data") ||
    name.includes("analytics") ||
    name.includes("statistics")
  ) {
    return ChartNoAxesCombined;
  }
  if (
    name.includes("software") ||
    name.includes("backend") ||
    name.includes("developer") ||
    name.includes("program") ||
    name.includes("engineer")
  ) {
    return Code2;
  }
  if (
    name.includes("policy") ||
    name.includes("public") ||
    name.includes("community") ||
    name.includes("government") ||
    name.includes("civil service") ||
    name.includes("administration")
  ) {
    return BriefcaseBusiness;
  }
  return Compass;
}

function normalizeDirections(directions) {
  if (!Array.isArray(directions)) return [];

  return directions
    .map((direction) =>
      typeof direction === "string"
        ? { name: direction, fit_score: null, reason: "" }
        : direction,
    )
    .filter(
      (direction) =>
        typeof direction.name === "string" && direction.name.trim(),
    )
    .sort((a, b) => {
      const statusDifference =
        (STATUS_ORDER[a.eligibility_status] ??
          STATUS_ORDER.needs_more_information) -
        (STATUS_ORDER[b.eligibility_status] ??
          STATUS_ORDER.needs_more_information);

      if (statusDifference !== 0) return statusDifference;
      return (Number(b.fit_score) || 0) - (Number(a.fit_score) || 0);
    });
}

function CareerPathExplorer() {
  const navigate = useNavigate();
  const studentId = getStudentId();

  const [interest, setInterest] = useState("");
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [needsInterest, setNeedsInterest] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCareerPaths() {
      if (!studentId) {
        setError("Student information is missing. Please sign in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        // Refresh cached legacy suggestions once per browser tab session so
        // the new role-focused prompt takes effect without repeated AI calls
        // every time the student returns to this screen.
        const refreshKey = `earn-career-paths-v2:${studentId}`;
        const shouldRefresh = sessionStorage.getItem(refreshKey) !== "done";
        const result = await getStudentCareerDirections(
          studentId,
          shouldRefresh,
        );

        if (cancelled) return;

        if (!result.has_analysis) {
          setNeedsInterest(true);
          setDirections([]);
          setInterest(result.interest || "");
          setError(
            result.message ||
              "Complete Interest+ first to discover career pathways.",
          );
          return;
        }

        setNeedsInterest(false);
        setInterest(result.interest || "");
        setDirections(normalizeDirections(result.directions));
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Could not load career path recommendations.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCareerPaths();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const handleRefresh = async () => {
    if (!studentId) {
      setError("Student information is missing. Please sign in again.");
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const result = await getStudentCareerDirections(studentId, true);

      if (!result.has_analysis) {
        setNeedsInterest(true);
        setDirections([]);
        setInterest(result.interest || "");
        setError(
          result.message ||
            "Complete Interest+ first to discover career pathways.",
        );
        return;
      }

      setNeedsInterest(false);
      setInterest(result.interest || "");
      setDirections(normalizeDirections(result.directions));
      sessionStorage.setItem(`earn-career-paths-v2:${studentId}`, "done");
    } catch (err) {
      setError(err.message || "Could not refresh career recommendations.");
    } finally {
      setRefreshing(false);
    }
  };

  const openPath = (direction) => {
    navigate("/student/roadmap", {
      state: {
        direction: direction.name,
        careerPath: direction,
      },
    });
  };

  if (loading) {
    return (
      <div className="career-explorer-page">
        <header className="career-explorer-header">
          <button
            className="career-explorer-back"
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="career-explorer-brand">
            <Compass size={19} />
            <span>Career Pathways</span>
          </div>
          <span />
        </header>
        <main className="career-explorer-main">
          <section className="career-explorer-loading">
            <div className="career-explorer-spinner" />
            <h2>Finding career paths related to your interests...</h2>
            <p>
              We are using your Interest+ answers and assessed capabilities to
              identify roles worth exploring.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="career-explorer-page">
      <header className="career-explorer-header">
        <button
          className="career-explorer-back"
          onClick={() => navigate("/student/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>
        <div className="career-explorer-brand">
          <Compass size={19} />
          <span>Career Pathways</span>
        </div>
        <button
          className="career-explorer-refresh"
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Generate fresh career path suggestions"
        >
          <RefreshCw size={14} className={refreshing ? "career-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh paths"}
        </button>
      </header>

      <main className="career-explorer-main">
        <section className="career-explorer-intro">
          <span className="career-explorer-eyebrow">
            YOUR INTERESTS, MULTIPLE POSSIBILITIES
          </span>
          <h1>Explore where your interests can take you.</h1>
          <p>
            Choose a career path to see its ordered learning roadmap, the skills
            involved, and the areas you may need to develop. These are options
            to explore—not predictions of career success.
          </p>
        </section>

        {interest && (
          <section className="career-interest-context">
            <div className="career-interest-icon">
              <Target size={20} />
            </div>
            <div>
              <span>BASED ON YOUR INTEREST PROFILE</span>
              <strong>{interest}</strong>
            </div>
          </section>
        )}

        {error && (
          <div className="career-explorer-alert" role="alert">
            <p>{error}</p>
            {needsInterest && (
              <button
                className="career-explorer-primary"
                type="button"
                onClick={() => navigate("/student/interest")}
              >
                Complete Interest+ <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        <section className="career-paths-section">
          <div className="career-paths-heading">
            <div>
              <span className="career-explorer-eyebrow">
                PERSONALIZED EXPLORATION
              </span>
              <h2>Career paths to explore</h2>
              <p>
                Select a path to review its entry route, required skills, and
                personalized roadmap. Exploring a path does not commit you to
                it.
              </p>
            </div>
            <span className="career-path-count">
              {directions.length} {directions.length === 1 ? "path" : "paths"}
            </span>
          </div>

          {directions.length > 0 ? (
            <div className="career-path-grid">
              {directions.map((direction, index) => {
                const Icon = getPathIcon(direction.name);
                const score =
                  direction.fit_score == null
                    ? null
                    : Math.max(
                        0,
                        Math.min(100, Number(direction.fit_score) || 0),
                      );
                const status =
                  ELIGIBILITY_META[direction.eligibility_status] ||
                  ELIGIBILITY_META.needs_more_information;
                const StatusIcon = status.Icon;
                const isNotPossible =
                  direction.eligibility_status === "not_possible";

                return (
                  <article
                    className={`career-path-card ${isNotPossible ? "career-path-card-blocked" : ""}`}
                    key={direction.name}
                  >
                    <div className="career-path-card-top">
                      <div className="career-path-icon">
                        <Icon size={22} />
                      </div>
                      <span className="career-path-number">
                        PATH {String(index + 1).padStart(2, "0")}
                      </span>
                      {direction.pathway_type && (
                        <span className="pathway-type-tag">
                          {String(direction.pathway_type).replaceAll("_", " ")}
                        </span>
                      )}
                    </div>

                    <div className="career-path-status-row">
                      <span className={`eligibility-badge ${status.className}`}>
                        <StatusIcon size={14} />
                        {status.label}
                      </span>
                    </div>

                    <h3>{direction.name}</h3>
                    <p className="career-path-reason">
                      {direction.reason ||
                        "Suggested for exploration based on your Interest+ profile."}
                    </p>

                    {direction.pathway_summary && (
                      <div className="entry-route-summary">
                        <span>Typical entry route</span>
                        <p>{direction.pathway_summary}</p>
                      </div>
                    )}

                    {Array.isArray(direction.missing_information) &&
                      direction.missing_information.length > 0 && (
                        <div className="missing-facts">
                          <strong>Still to verify</strong>
                          <ul>
                            {direction.missing_information
                              .slice(0, 3)
                              .map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                          </ul>
                        </div>
                      )}

                    {Array.isArray(direction.official_resources) &&
                      direction.official_resources.length > 0 && (
                        <div className="official-resource-list">
                          {direction.official_resources
                            .slice(0, 2)
                            .map((resource) => (
                              <a
                                key={resource.url}
                                href={resource.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {resource.label}
                                <ArrowRight size={13} />
                              </a>
                            ))}
                        </div>
                      )}

                    {score !== null && (
                      <div className="career-fit">
                        <div className="career-fit-label">
                          <span>Exploration fit</span>
                          <strong>{score}/100</strong>
                        </div>
                        <div
                          className="career-fit-track"
                          role="img"
                          aria-label={`Exploration fit score: ${score} out of 100`}
                        >
                          <span style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="career-path-card-footer">
                      <span>{status.detail}</span>
                      <button
                        className="career-path-open"
                        type="button"
                        onClick={() => openPath(direction)}
                      >
                        {isNotPossible
                          ? "Review eligibility barrier"
                          : "View entry roadmap"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="career-explorer-empty">
              <div className="career-path-icon">
                <Map size={22} />
              </div>
              <h3>
                {needsInterest
                  ? "Complete Interest+ to continue"
                  : "No career paths available yet"}
              </h3>
              <p>
                {needsInterest
                  ? "Complete your Interest+ assessment first. E.A.R.N. will use your answers and assessed capabilities to suggest related career paths."
                  : "Refresh recommendations to discover roles related to your interests."}
              </p>
              <button
                className="career-explorer-primary"
                type="button"
                onClick={
                  needsInterest
                    ? () => navigate("/student/interest")
                    : handleRefresh
                }
                disabled={refreshing}
              >
                {needsInterest ? "Complete Interest+" : "Generate career paths"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>

        <aside className="career-explorer-note">
          <Sparkles size={18} aria-hidden="true" />
          <p>
            Each path opens an ordered roadmap with milestones and focus skills.
            The skill sequence is a suggested learning route; it can be refined
            as you build evidence of your abilities.
          </p>
        </aside>
      </main>
    </div>
  );
}

export default CareerPathExplorer;
