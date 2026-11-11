import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Compass,
  Puzzle,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  getStudentCareerDirections,
  getStudentRoadmap,
} from "../../services/studentService";
import "./StudentRoadmap.css";

const DIFFICULTY_CONFIG = {
  low: { label: "Lower transition difficulty", badgeClass: "difficulty-low" },
  moderate: {
    label: "Moderate transition difficulty",
    badgeClass: "difficulty-moderate",
  },
  high: { label: "Higher transition difficulty", badgeClass: "difficulty-high" },
};

const ELIGIBILITY_CONFIG = {
  feasible: {
    label: "Route appears feasible",
    className: "route-feasible",
  },
  needs_preparation: {
    label: "Preparation or qualification required",
    className: "route-preparation",
  },
  eligibility_unconfirmed: {
    label: "Eligibility needs verification",
    className: "route-unconfirmed",
  },
  not_possible: {
    label: "NOT POSSIBLE under the supplied facts",
    className: "route-not-possible",
  },
};

const PATHWAY_STATUS_TO_ROADMAP_STATUS = {
  possible_now: "feasible",
  possible_after_graduation: "needs_preparation",
  additional_qualification_required: "needs_preparation",
  needs_more_information: "eligibility_unconfirmed",
  not_possible: "not_possible",
};

const STEP_TYPE_LABELS = {
  eligibility_check: "Eligibility check",
  education: "Education / qualification",
  entrance_exam: "Admission test",
  competitive_exam: "Competitive examination",
  application: "Application",
  selection_stage: "Selection stage",
  skill_development: "Skill development",
  experience: "Experience",
  portfolio: "Portfolio",
  job_search: "Job search",
  other: "Route step",
};

function getStudentId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.student_id || user.user_id || "";
  } catch {
    return "";
  }
}

function normalizeDirections(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) =>
      typeof item === "string"
        ? { name: item, fit_score: null, reason: "" }
        : item,
    )
    .filter((item) => item && typeof item.name === "string" && item.name.trim());
}

function StudentRoadmap() {
  const navigate = useNavigate();
  const location = useLocation();
  const studentId = getStudentId();
  const initialDirection = location.state?.direction || "";
  const initialCareerPath = location.state?.careerPath || null;

  const [roadmapData, setRoadmapData] = useState(null);
  const [directions, setDirections] = useState([]);
  const [selectedDirection, setSelectedDirection] = useState(initialDirection);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const waitForRoadmap = async (direction, forceRefresh = false) => {
    const deadline = Date.now() + 6 * 60 * 1000;
    let delayMs = 1800;
    let response = await getStudentRoadmap(
      studentId,
      direction,
      forceRefresh,
    );

    while (Date.now() < deadline) {
      if (
        response?.status === "completed" ||
        response?.status === "blocked" ||
        response?.status === "path_not_found" ||
        response?.status === "missing"
      ) {
        return response;
      }

      if (response?.status === "error") {
        throw new Error(response.detail || "Career roadmap generation failed.");
      }

      if (
        response?.has_analysis === true &&
        Array.isArray(response.roadmap)
      ) {
        return response;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delayMs, remaining)),
      );
      delayMs = Math.min(Math.round(delayMs * 1.35), 5000);
      response = await getStudentRoadmap(studentId, direction, false);
    }

    throw new Error(
      "Roadmap generation is taking longer than expected. The job may still be running; try refreshing.",
    );
  };

  useEffect(() => {
    let cancelled = false;

    async function loadRoadmap() {
      setLoading(true);
      setError("");

      try {
        if (!studentId) {
          throw new Error("Student information is missing. Please sign in again.");
        }

        const directionResponse = await getStudentCareerDirections(studentId);
        if (cancelled) return;

        if (!directionResponse?.has_analysis) {
          setDirections([]);
          setRoadmapData(null);
          setError(
            directionResponse?.message ||
              "Complete the Interest+ assessment before opening a career roadmap.",
          );
          return;
        }

        const availableDirections = normalizeDirections(
          directionResponse.directions,
        );
        setDirections(availableDirections);

        const selectedPath =
          availableDirections.find((item) => item.name === initialDirection) ||
          (initialCareerPath?.name === initialDirection
            ? initialCareerPath
            : null) ||
          availableDirections[0];

        if (!selectedPath?.name) {
          setRoadmapData(null);
          setError(
            "No career directions are available yet. Refresh Career Paths after completing Interest+.",
          );
          return;
        }

        setSelectedDirection(selectedPath.name);
        const response = await waitForRoadmap(selectedPath.name);
        if (cancelled) return;

        if (response?.status === "path_not_found") {
          setRoadmapData(null);
          setError(
            response.detail ||
              "This path is no longer in your recommendations. Return to Career Paths and choose another role.",
          );
          return;
        }

        if (response?.has_analysis === false) {
          setRoadmapData(null);
          setError(
            response.detail ||
              "The roadmap could not be generated for this career direction.",
          );
          return;
        }

        setRoadmapData(response);
      } catch (err) {
        if (!cancelled) {
          setRoadmapData(null);
          setError(
            err.message || "Failed to load the career roadmap.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRoadmap();
    return () => {
      cancelled = true;
    };
  }, [studentId, navigate, initialDirection, initialCareerPath]);

  const handleSelectDirection = async (direction) => {
    if (!direction || direction === selectedDirection) return;

    setSelectedDirection(direction);
    setLoading(true);
    setError("");

    try {
      const response = await waitForRoadmap(direction);
      if (response?.status === "path_not_found") {
        setRoadmapData(null);
        setError(
          response.detail ||
            "This path is no longer in your recommendations. Return to Career Paths.",
        );
      } else if (response?.has_analysis === false) {
        setRoadmapData(null);
        setError(response.detail || "Roadmap unavailable for this direction.");
      } else {
        setRoadmapData(response);
      }
    } catch (err) {
      setError(err.message || "Failed to generate the selected roadmap.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const direction = selectedDirection || roadmapData?.direction;
    if (!direction) {
      setError("No career direction is selected.");
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const response = await waitForRoadmap(direction, true);
      if (response?.status === "path_not_found") {
        setRoadmapData(null);
        setError(response.detail || "This career path is no longer available.");
      } else if (response?.has_analysis === false) {
        setError(response.detail || "Roadmap refresh could not be completed.");
      } else {
        setRoadmapData(response);
      }
    } catch (err) {
      setError(err.message || "Failed to refresh the career roadmap.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="roadmap-page">
        <header className="roadmap-header">
          <button
            className="roadmap-back"
            type="button"
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="roadmap-brand">
            <Sparkles size={19} />
            <span>E.A.R.N. Roadmap</span>
          </div>
        </header>
        <main className="roadmap-main">
          <section className="roadmap-state-card">
            <div className="roadmap-spinner" />
            <h2>Building your career-entry roadmap...</h2>
            <p>
              Connecting the selected role to its qualifications, examinations,
              applications, and preparation stages.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (error && !roadmapData) {
    return (
      <div className="roadmap-page">
        <header className="roadmap-header">
          <button
            className="roadmap-back"
            type="button"
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="roadmap-brand">
            <Sparkles size={19} />
            <span>E.A.R.N. Roadmap</span>
          </div>
        </header>
        <main className="roadmap-main">
          <section className="roadmap-state-card roadmap-error-card">
            <AlertTriangle size={32} />
            <h2>Roadmap unavailable</h2>
            <p>{error}</p>
            <div className="roadmap-state-actions">
              <button
                className="roadmap-primary-btn"
                type="button"
                onClick={() => navigate("/student/career-paths")}
              >
                <Compass size={16} />
                Explore Career Paths
              </button>
              <button
                className="roadmap-secondary-btn"
                type="button"
                onClick={() => navigate("/student/dashboard")}
              >
                Back to Dashboard
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const displayedDirection =
    roadmapData?.direction || selectedDirection || "Selected career path";
  const steps = Array.isArray(roadmapData?.roadmap)
    ? roadmapData.roadmap
    : [];
  const selectedCareerPath =
    directions.find((item) => item.name === displayedDirection) ||
    (initialCareerPath?.name === displayedDirection ? initialCareerPath : null) ||
    roadmapData?.career_path ||
    null;
  const isBlockedPath =
    roadmapData?.blocked_path === true ||
    roadmapData?.status === "blocked" ||
    selectedCareerPath?.eligibility_status === "not_possible";
  const difficulty =
    DIFFICULTY_CONFIG[roadmapData?.transition_difficulty] ||
    DIFFICULTY_CONFIG.moderate;
  const eligibilityStatus =
    roadmapData?.eligibility_status ||
    PATHWAY_STATUS_TO_ROADMAP_STATUS[
      selectedCareerPath?.eligibility_status
    ] ||
    "eligibility_unconfirmed";
  const eligibility =
    ELIGIBILITY_CONFIG[eligibilityStatus] ||
    ELIGIBILITY_CONFIG.eligibility_unconfirmed;

  return (
    <div className="roadmap-page">
      <header className="roadmap-header">
        <button
          className="roadmap-back"
          type="button"
          onClick={() => navigate("/student/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="roadmap-brand">
          <Sparkles size={19} />
          <span>E.A.R.N. Roadmap</span>
        </div>

        <button
          className="roadmap-refresh-btn"
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || isBlockedPath}
          title={
            isBlockedPath
              ? "This route is blocked by the available eligibility assessment."
              : "Regenerate the career-entry roadmap."
          }
        >
          <RotateCcw
            size={14}
            className={refreshing ? "roadmap-spin-icon" : ""}
          />
          {isBlockedPath
            ? "Eligibility blocked"
            : refreshing
              ? "Regenerating..."
              : "Regenerate route"}
        </button>
      </header>

      <main className="roadmap-main">
        <section className="roadmap-intro">
          <span className="roadmap-eyebrow">STEP-BY-STEP TRANSITION PATH</span>
          <h1>Career Entry Roadmap</h1>
          <p>
            Follow the qualification, exam or admission steps, applications,
            and targeted preparation needed to pursue{" "}
            <strong>{displayedDirection}</strong>.
          </p>
        </section>

        <section className="career-direction-card">
          <div className="career-direction-icon">
            <BriefcaseBusiness size={23} />
          </div>
          <div className="career-direction-content">
            <span className="career-direction-label">CAREER DIRECTION</span>
            <h2>{displayedDirection}</h2>
            <p>
              This route is generated from your Interest+ assessment and the
              selected career pathway. Missing eligibility details are treated
              as unknown and should be verified against official requirements.
            </p>
          </div>
        </section>

        {error && roadmapData && (
          <div className="roadmap-inline-error" role="status">
            {error}
          </div>
        )}

        {directions.length > 1 && (
          <section className="directions-selector-section">
            <span className="section-small-label">SWITCH CAREER DIRECTION:</span>
            <div className="directions-tabs">
              {directions.map((direction) => (
                <button
                  key={direction.name}
                  type="button"
                  className={
                    "direction-tab-btn" +
                    (displayedDirection === direction.name ? " active" : "")
                  }
                  onClick={() => handleSelectDirection(direction.name)}
                  disabled={loading}
                >
                  <span className="dir-name">{direction.name}</span>
                  {direction.fit_score != null && (
                    <span className="dir-fit">
                      {direction.fit_score}% Fit
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="roadmap-summary-card">
          <div className="summary-left">
            <div className="summary-icon">
              <Compass size={26} />
            </div>
            <div>
              <span className="summary-label">SELECTED CAREER PATH</span>
              <h2>{displayedDirection}</h2>
              <div className="difficulty-badge-wrap">
                {isBlockedPath ? (
                  <span className="pathway-blocked-badge">
                    <AlertTriangle size={13} />
                    NOT POSSIBLE
                  </span>
                ) : roadmapData?.transition_difficulty ? (
                  <span className={"diff-pill " + difficulty.badgeClass}>
                    {difficulty.label}
                  </span>
                ) : null}
                <span className="milestones-count">
                  {isBlockedPath
                    ? "Eligibility barrier identified"
                    : steps.length + " Entry Steps"}
                </span>
              </div>
            </div>
          </div>

          <div className="summary-actions">
            {isBlockedPath ? (
              <button
                className="action-btn secondary"
                type="button"
                onClick={() => navigate("/student/career-paths")}
              >
                <Compass size={16} />
                Explore other pathways
              </button>
            ) : (
              <button
                className="action-btn secondary"
                type="button"
                onClick={() =>
                  navigate("/student/skills", {
                    state: { direction: displayedDirection },
                  })
                }
              >
                <Puzzle size={16} />
                Review Skill Gaps
              </button>
            )}
          </div>

          {selectedCareerPath?.pathway_summary && (
            <div className="entry-route-summary roadmap-entry-summary">
              <strong>Typical entry route</strong>
              <p>{selectedCareerPath.pathway_summary}</p>
            </div>
          )}

          {(selectedCareerPath?.eligibility_reason ||
            roadmapData?.eligibility_reason) && (
            <div
              className={
                "roadmap-eligibility-reason" +
                (isBlockedPath ? " blocked" : "")
              }
            >
              {isBlockedPath && <AlertTriangle size={17} />}
              <div>
                <strong>
                  {isBlockedPath
                    ? "Why this route is flagged"
                    : "Eligibility assessment"}
                </strong>
                <p>
                  {selectedCareerPath?.eligibility_reason ||
                    roadmapData?.eligibility_reason}
                </p>
              </div>
            </div>
          )}

          {Array.isArray(selectedCareerPath?.official_resources) &&
            selectedCareerPath.official_resources.length > 0 && (
              <div className="roadmap-official-resources">
                <strong>Official sources to verify requirements</strong>
                <div>
                  {selectedCareerPath.official_resources.map((resource) => (
                    <a
                      key={resource.url || resource.label}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {resource.label}
                      <ChevronRight size={14} />
                    </a>
                  ))}
                </div>
              </div>
            )}

          {roadmapData?.transition_reason && (
            <div className="summary-reason-box">
              <strong>Pathway assessment:</strong>
              <p>{roadmapData.transition_reason}</p>
            </div>
          )}
        </section>

        {isBlockedPath ? (
          <section className="blocked-path-panel">
            <div className="blocked-path-heading">
              <AlertTriangle size={23} />
              <div>
                <h2>This path is not currently recommended</h2>
                <p>
                  The available profile facts indicate a possible hard
                  eligibility barrier. Verify the linked official requirements
                  before making a final decision.
                </p>
              </div>
            </div>
            <h3>Explore these alternatives</h3>
            <div className="roadmap-alternative-list">
              {directions
                .filter(
                  (item) =>
                    item.name !== displayedDirection &&
                    item.eligibility_status !== "not_possible",
                )
                .slice(0, 3)
                .map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectDirection(item.name)}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.eligibility_reason || item.pathway_summary}
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
            </div>
          </section>
        ) : (
          <>
            <section
              className={
                "roadmap-eligibility-card " + eligibility.className
              }
            >
              <div>
                <span className="route-status-label">{eligibility.label}</span>
                <p>
                  {roadmapData?.eligibility_reason ||
                    selectedCareerPath?.eligibility_reason ||
                    "The available information does not confirm every entry requirement for this route."}
                </p>
              </div>
              <small>
                Verify age limits, qualifications, application dates, and other
                criteria in the latest official notification or institution
                information.
              </small>
            </section>

            <section className="timeline-section">
              <div className="timeline-header">
                <div className="timeline-icon">
                  <Target size={20} />
                </div>
                <div>
                  <h2>Career route, step by step</h2>
                  <span>
                    Follow the qualification, admission, examination,
                    application, and preparation sequence in order.
                  </span>
                </div>
              </div>

              {steps.length > 0 ? (
                <div className="timeline-steps">
                  {steps.map((step, index) => {
                    const routeType =
                      step.route_type || step.step_type || "skill_development";
                    const stepNumber = step.step || index + 1;
                    const paddedNumber = String(stepNumber).padStart(2, "0");

                    return (
                      <article
                        className="timeline-item"
                        key={step.step || index}
                      >
                        <div className="timeline-marker" aria-hidden="true">
                          <div className="marker-number">{paddedNumber}</div>
                          {index < steps.length - 1 && (
                            <div className="marker-line" />
                          )}
                        </div>

                        <div className="timeline-card">
                          <div className="timeline-card-header">
                            <span className="step-tag">
                              STEP {paddedNumber}
                            </span>
                            <span
                              className={
                                "route-step-type route-type-" + routeType
                              }
                            >
                              {STEP_TYPE_LABELS[routeType] || "Route step"}
                            </span>
                            <h3>{step.title}</h3>
                          </div>

                          <div className="route-step-meta">
                            {step.estimated_duration && (
                              <span className="route-step-duration">
                                <CalendarClock size={13} />
                                {step.estimated_duration}
                              </span>
                            )}
                          </div>

                          <p className="step-description">
                            {step.description}
                          </p>

                          {step.completion_evidence && (
                            <div className="step-completion-evidence">
                              <CheckCircle2 size={15} />
                              <p>
                                <strong>Completion evidence:</strong>{" "}
                                {step.completion_evidence}
                              </p>
                            </div>
                          )}

                          {step.official_resource_url && (
                            <a
                              className="step-official-link"
                              href={step.official_resource_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {step.official_resource_label ||
                                "Open official source"}
                              <ChevronRight size={14} />
                            </a>
                          )}

                          {Array.isArray(step.skills) &&
                            step.skills.length > 0 && (
                              <div className="step-skills-wrap">
                                <span className="skills-label">Focus skills</span>
                                <div className="skills-tags">
                                  {step.skills.map((skill, skillIndex) => (
                                    <span
                                      key={skillIndex}
                                      className="skill-tag"
                                    >
                                      <Target size={12} />
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="roadmap-empty-state">
                  <h3>No roadmap steps are available yet</h3>
                  <p>
                    Refresh the route to retry roadmap generation, or review
                    the selected career path and its official requirements.
                  </p>
                  <button
                    className="roadmap-secondary-btn"
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    <RotateCcw size={15} />
                    Try again
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        <section className="roadmap-footer-banner">
          <div>
            <span className="roadmap-eyebrow">CONTINUE YOUR JOURNEY</span>
            <h2>Track Your Growth</h2>
            <p>
              Review your Interest+ assessment and skill gaps as you complete
              the qualifications and preparation steps in this route.
            </p>
          </div>
          <div className="footer-actions">
            <button
              className="action-btn secondary"
              type="button"
              onClick={() =>
                navigate("/student/skills", {
                  state: { direction: displayedDirection },
                })
              }
            >
              <Puzzle size={16} />
              View Skill Gaps
            </button>
          </div>
        </section>

        <div className="roadmap-bottom-nav">
          <button
            className="roadmap-secondary-btn"
            type="button"
            onClick={() => navigate("/student/career-paths")}
          >
            <Compass size={16} />
            Back to Career Paths
          </button>
        </div>
      </main>
    </div>
  );
}

export default StudentRoadmap;
