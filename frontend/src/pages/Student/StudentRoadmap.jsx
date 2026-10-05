import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Puzzle,
  Compass,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  ChevronRight,
  Milestone,
  Target,
} from "lucide-react";
import {
  getStudentRoadmap,
  getStudentCareerDirections,
} from "../../services/studentService";
import "./StudentRoadmap.css";

const DIFFICULTY_CONFIG = {
  low: {
    label: "Low Transition Barrier",
    badgeClass: "diff-badge-low",
    color: "#34d399",
  },
  moderate: {
    label: "Moderate Transition Effort",
    badgeClass: "diff-badge-mod",
    color: "#fbbf24",
  },
  high: {
    label: "High Skill Growth Required",
    badgeClass: "diff-badge-high",
    color: "#f87171",
  },
};

function StudentRoadmap() {
  const navigate = useNavigate();
  const location = useLocation();

  const [roadmapData, setRoadmapData] = useState(null);
  const [directions, setDirections] = useState([]);
  const [selectedDirection, setSelectedDirection] = useState(
    location.state?.direction || null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const getStudentId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.student_id || user.user_id || "STU001";
    } catch {
      return "STU001";
    }
  };

  const studentId = getStudentId();

  const waitForRoadmap = async (direction) => {
    for (let i = 0; i < 30; i++) {
      const res = await getStudentRoadmap(studentId, direction);

      if (res.status === "completed" && res.has_analysis) {
        return res;
      }

      if (res.status === "missing") {
        throw new Error(res.detail || "Roadmap analysis is unavailable.");
      }

      if (res.status === "error") {
        throw new Error(res.detail || "Roadmap analysis failed.");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error("Roadmap analysis timed out.");
  };

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        let availableDirs = [];
        try {
          const dirRes = await getStudentCareerDirections(studentId);
          if (dirRes.has_analysis && Array.isArray(dirRes.directions)) {
            availableDirs = dirRes.directions;
            if (isMounted) setDirections(availableDirs);
          }
        } catch (e) {
          console.warn("Could not load career directions list:", e);
        }

        const targetDir =
          selectedDirection ||
          (availableDirs.length > 0 ? availableDirs[0].name : null);

        const res = await waitForRoadmap(targetDir);

        if (isMounted) {
          if (res.has_analysis === false) {
            setError(
              res.detail ||
                "Interest profile is not ready yet. Please complete the Interest+ discovery quiz first.",
            );
            setRoadmapData(null);
          } else {
            setRoadmapData(res);
            if (res.direction && !selectedDirection) {
              setSelectedDirection(res.direction);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.message ||
              "Failed to load AI Roadmap. Please check backend connection.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleSelectDirection = async (dirName) => {
    if (dirName === selectedDirection && roadmapData) return;
    try {
      setSelectedDirection(dirName);
      setLoading(true);
      setError("");
      const res = await waitForRoadmap(dirName);
      if (res.has_analysis) {
        setRoadmapData(res);
      } else {
        setError(res.detail || "Roadmap unavailable for this direction.");
      }
    } catch (err) {
      setError(err.message || "Failed to generate roadmap for direction.");
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

    try {
      setRefreshing(true);
      setError("");

      // Start a new analysis
      const initial = await getStudentRoadmap(studentId, direction, true);

      if (initial.status === "processing") {
        const finalRes = await waitForRoadmap(direction);

        if (finalRes.has_analysis) {
          setRoadmapData(finalRes);
        } else {
          setError(
            finalRes.detail || "Roadmap analysis could not be completed.",
          );
        }

        return;
      }

      if (initial.has_analysis) {
        setRoadmapData(initial);
      } else {
        setError(initial.detail || "Roadmap analysis is unavailable.");
      }
    } catch (err) {
      setError(err.message || "Failed to refresh AI roadmap.");
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
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="roadmap-brand">
            <Sparkles size={19} />
            <span>AI Learning Roadmap</span>
          </div>
        </header>
        <main className="roadmap-main">
          <section className="state-card">
            <div className="ai-spinner" />
            <h2>Synthesizing Personalized Roadmap...</h2>
            <p>
              The AI is organizing milestone learning sequences tailored to
              bridge your specific skill gaps.
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
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="roadmap-brand">
            <Sparkles size={19} />
            <span>AI Learning Roadmap</span>
          </div>
        </header>
        <main className="roadmap-main">
          <section className="state-card error">
            <AlertTriangle size={32} color="#f87171" />
            <h2>Roadmap Unavailable</h2>
            <p>{error}</p>
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button
                className="action-btn primary"
                onClick={() => navigate("/student/interest")}
              >
                <Sparkles size={16} />
                Start Interest+ Quiz
              </button>
              <button
                className="action-btn secondary"
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

  const steps = roadmapData?.roadmap || [];
  const diffCfg =
    DIFFICULTY_CONFIG[roadmapData?.transition_difficulty] ||
    DIFFICULTY_CONFIG.moderate;

  return (
    <div className="roadmap-page">
      <header className="roadmap-header">
        <button
          className="roadmap-back"
          onClick={() => navigate("/student/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="roadmap-brand">
          <Sparkles size={19} />
          <span>Personalized AI Roadmap</span>
        </div>

        <button
          className="roadmap-refresh-btn"
          disabled={refreshing}
          onClick={handleRefresh}
          title="Regenerate Roadmap with AI"
        >
          <RotateCcw size={14} className={refreshing ? "spin-icon" : ""} />
          {refreshing ? "Synthesizing..." : "Regenerate Roadmap"}
        </button>
      </header>

      <main className="roadmap-main">
        {/* Intro */}
        <section className="roadmap-intro">
          <span className="roadmap-eyebrow">STEP-BY-STEP TRANSITION PATH</span>
          <h1>Personalized Learning Roadmap</h1>
          <p>
            Structured milestones designed to guide your transition into{" "}
            <strong>{roadmapData?.direction || "your target role"}</strong>.
          </p>
        </section>

        {/* Direction Switcher */}
        {directions.length > 0 && (
          <section className="directions-selector-section">
            <span className="section-small-label">
              SWITCH CAREER DIRECTION:
            </span>
            <div className="directions-tabs">
              {directions.map((dir, idx) => {
                const isActive =
                  (selectedDirection || roadmapData?.direction) === dir.name;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`direction-tab-btn ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectDirection(dir.name)}
                  >
                    <span className="dir-name">{dir.name}</span>
                    {dir.fit_score != null && (
                      <span className="dir-fit">{dir.fit_score}% Fit</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Direction & Difficulty Summary Card */}
        <section className="roadmap-summary-card">
          <div className="summary-left">
            <div className="summary-icon">
              <Compass size={26} />
            </div>
            <div>
              <span className="summary-label">CHOSEN DIRECTION</span>
              <h2>{roadmapData?.direction}</h2>
              <div className="difficulty-badge-wrap">
                <span className={`diff-pill ${diffCfg.badgeClass}`}>
                  {diffCfg.label}
                </span>
                <span className="milestones-count">
                  {steps.length} Milestone Steps
                </span>
              </div>
            </div>
          </div>

          <div className="summary-actions">
            <button
              className="action-btn secondary"
              onClick={() =>
                navigate("/student/skills", {
                  state: { direction: roadmapData?.direction },
                })
              }
            >
              <Puzzle size={16} />
              Review Skill Gaps
            </button>
          </div>

          {roadmapData?.transition_reason && (
            <div className="summary-reason-box">
              <strong>AI Transition Assessment:</strong>
              <p>{roadmapData.transition_reason}</p>
            </div>
          )}
        </section>

        {/* Roadmap Timeline */}
        <section className="timeline-section">
          <div className="timeline-header">
            <div className="timeline-icon">
              <Milestone size={20} />
            </div>
            <div>
              <h2>Milestone Learning Path</h2>
              <span>
                Recommended chronological order to develop missing capabilities
              </span>
            </div>
          </div>

          <div className="timeline-steps">
            {steps.map((step, idx) => {
              const stepNumber = step.step || idx + 1;
              const paddedNumber =
                stepNumber < 10 ? `0${stepNumber}` : stepNumber;

              return (
                <div key={idx} className="timeline-item">
                  <div className="timeline-marker">
                    <div className="marker-number">{paddedNumber}</div>
                    {idx < steps.length - 1 && <div className="marker-line" />}
                  </div>

                  <div className="timeline-card">
                    <div className="timeline-card-header">
                      <span className="step-tag">Step {paddedNumber}</span>
                      <h3>{step.title}</h3>
                    </div>

                    <p className="step-description">{step.description}</p>

                    {Array.isArray(step.skills) && step.skills.length > 0 && (
                      <div className="step-skills-wrap">
                        <span className="skills-label">Focus Skills:</span>
                        <div className="skills-tags">
                          {step.skills.map((skill, sIdx) => (
                            <span key={sIdx} className="skill-tag">
                              <Target size={12} />
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer Navigation */}
        <section className="roadmap-footer-banner">
          <div>
            <span className="roadmap-eyebrow">CONTINUE YOUR JOURNEY</span>
            <h2>Track Your Growth</h2>
            <p>
              Revisit your Interest Profile or Skill Gaps anytime as you
              complete projects and learn new skills.
            </p>
          </div>

          <div className="footer-actions">
            <button
              className="action-btn secondary"
              onClick={() =>
                navigate("/student/skills", {
                  state: { direction: roadmapData?.direction },
                })
              }
            >
              <Puzzle size={16} />
              View Skill Gaps
            </button>

            <button
              className="action-btn primary"
              onClick={() => navigate("/student/dashboard")}
            >
              Back to Dashboard
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default StudentRoadmap;
