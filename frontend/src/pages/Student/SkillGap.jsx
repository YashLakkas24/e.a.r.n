import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Puzzle,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Layers,
  Award,
  ChevronRight,
  Flame,
} from "lucide-react";
import {
  getStudentSkillGap,
  getStudentCareerDirections,
} from "../../services/studentService";
import "./SkillGap.css";

const STATUS_CONFIG = {
  actual_gap: {
    label: "High Priority Gap",
    badgeClass: "badge-gap-actual",
    icon: Flame,
    color: "#f87171",
  },
  small_gap: {
    label: "Moderate Gap",
    badgeClass: "badge-gap-small",
    icon: AlertTriangle,
    color: "#fbbf24",
  },
  no_gap: {
    label: "Requirement Met",
    badgeClass: "badge-gap-none",
    icon: CheckCircle2,
    color: "#34d399",
  },
  assessment_needed: {
    label: "Assessment Needed",
    badgeClass: "badge-gap-needed",
    icon: HelpCircle,
    color: "#60a5fa",
  },
};

function SkillGap() {
  const navigate = useNavigate();
  const location = useLocation();

  const [gapData, setGapData] = useState(null);
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

  const waitForSkillGap = async (direction) => {
  for (let i = 0; i < 30; i++) {
    const res = await getStudentSkillGap(studentId, direction);

    if (res.status !== "processing") {
      return res;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Skill gap analysis timed out.");
};
  // Load directions list and initial skill gap
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        // Fetch directions
        let availableDirs = [];

        try {
          const dirRes = await getStudentCareerDirections(studentId);

          if (dirRes.has_analysis && Array.isArray(dirRes.directions)) {
            availableDirs = dirRes.directions;

            if (isMounted) {
              setDirections(availableDirs);
            }
          }
        } catch (e) {
          console.warn("Could not load career directions list:", e);
        }

        const targetDir =
          selectedDirection ||
          (availableDirs.length > 0 ? availableDirs[0].name : null);

        // Fetch skill gap analysis and wait if the backend is processing it
        const res = await waitForSkillGap(targetDir);

        if (isMounted) {
          if (res.has_analysis === false) {
            setError(
              res.detail ||
                "Interest analysis is not available yet. Please complete the Interest+ discovery quiz first.",
            );
            setGapData(null);
          } else if (res.has_analysis) {
            setGapData(res);

            if (res.direction && !selectedDirection) {
              setSelectedDirection(res.direction);
            }
          } else {
            setError(res.detail || "Analysis unavailable.");
            setGapData(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.message ||
              "Failed to load Skill Gap Analysis. Please ensure backend is running.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // Handle switching direction
  const handleSelectDirection = async (dirName) => {
    if (dirName === selectedDirection && gapData) return;
    try {
      setSelectedDirection(dirName);
      setLoading(true);
      setError("");
      const res = await waitForSkillGap(dirName);

if (res.has_analysis) {
        setGapData(res);
      } else {
        setError(res.detail || "Analysis unavailable for this direction.");
      }
    } catch (err) {
      setError(err.message || "Failed to analyze selected direction.");
    } finally {
      setLoading(false);
    }
  };

  // Force re-analysis from AI
  const handleRefresh = async () => {
    const direction = selectedDirection || gapData?.direction;

    if (!direction) {
      setError("No career direction is selected.");
      return;
    }

    try {
      setRefreshing(true);
      setError("");

      // force_refresh=true starts a new background analysis
      const res = await getStudentSkillGap(studentId, direction, true);

      // The backend returns 202/processing while the AI job runs.
      if (res.status === "processing") {
        const finalRes = await waitForSkillGap(direction);

        if (finalRes.has_analysis) {
          setGapData(finalRes);
        } else {
          setError(finalRes.detail || "Analysis unavailable.");
        }

        return;
      }

      if (res.has_analysis) {
        setGapData(res);
      } else {
        setError(res.detail || "Analysis unavailable.");
      }
    } catch (err) {
      setError(err.message || "Failed to refresh AI analysis.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="skill-gap-page">
        <header className="skill-gap-header">
          <button
            className="skill-gap-back"
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="skill-gap-brand">
            <Puzzle size={19} />
            <span>Skill Gap Analysis</span>
          </div>
        </header>
        <main className="skill-gap-main">
          <section className="state-card">
            <div className="ai-spinner" />
            <h2>Comparing Skills with Industry Requirements...</h2>
            <p>
              The AI is evaluating your Interest Profile against
              industry-standard capabilities.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (error && !gapData) {
    return (
      <div className="skill-gap-page">
        <header className="skill-gap-header">
          <button
            className="skill-gap-back"
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="skill-gap-brand">
            <Puzzle size={19} />
            <span>Skill Gap Analysis</span>
          </div>
        </header>
        <main className="skill-gap-main">
          <section className="state-card error">
            <AlertTriangle size={32} color="#f87171" />
            <h2>Skill Gap Analysis Unavailable</h2>
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

  const requiredSkills = gapData?.required_skills || [];
  const skillAssessments = gapData?.skill_assessments || [];
  const transferableSkills = gapData?.transferable_skills || [];
  const skillGaps = gapData?.skill_gaps || [];

  const actualGapsCount = skillGaps.filter(
    (g) => g.status === "actual_gap",
  ).length;
  const metRequirementsCount = skillGaps.filter(
    (g) => g.status === "no_gap",
  ).length;

  return (
    <div className="skill-gap-page">
      <header className="skill-gap-header">
        <button
          className="skill-gap-back"
          onClick={() => navigate("/student/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="skill-gap-brand">
          <Puzzle size={19} />
          <span>Skill Gap Intelligence</span>
        </div>

        <button
          className="skill-gap-refresh-btn"
          disabled={refreshing}
          onClick={handleRefresh}
          title="Re-run AI Analysis"
        >
          <RotateCcw size={14} className={refreshing ? "spin-icon" : ""} />
          {refreshing ? "Updating..." : "Refresh Analysis"}
        </button>
      </header>

      <main className="skill-gap-main">
        {/* Intro */}
        <section className="skill-gap-intro">
          <span className="skill-gap-eyebrow">AI CAPABILITY ASSESSMENT</span>
          <h1>Industry Skill Gap Analysis</h1>
          <p>
            Comparing your assessed capabilities in{" "}
            <strong>{gapData?.interest || "your chosen domain"}</strong> against
            industry-required benchmarks.
          </p>
        </section>

        {/* Direction Tabs / Selector */}
        {directions.length > 0 && (
          <section className="directions-selector-section">
            <span className="section-small-label">
              EXPLORE TARGET CAREER DIRECTIONS:
            </span>
            <div className="directions-tabs">
              {directions.map((dir, idx) => {
                const isActive =
                  (selectedDirection || gapData?.direction) === dir.name;
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

        {/* Active Target Direction Banner */}
        <section className="active-direction-card">
          <div className="direction-icon-wrap">
            <Layers size={24} />
          </div>
          <div className="direction-info-wrap">
            <span>TARGET DIRECTION</span>
            <h2>{gapData?.direction || "Career Path"}</h2>
            {gapData?.transition_difficulty && (
              <div className="transition-tag">
                <span>Transition Difficulty: </span>
                <strong className={`diff-${gapData.transition_difficulty}`}>
                  {gapData.transition_difficulty.toUpperCase()}
                </strong>
              </div>
            )}
          </div>
          <button
            className="action-btn primary"
            onClick={() =>
              navigate("/student/roadmap", {
                state: { direction: gapData?.direction },
              })
            }
          >
            <Sparkles size={16} />
            View AI Roadmap
            <ChevronRight size={16} />
          </button>
        </section>

        {/* Summary Metrics */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">
              <Layers size={20} />
            </div>
            <div>
              <span>Required Skills</span>
              <strong>{requiredSkills.length}</strong>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon highlight-gap">
              <Flame size={20} />
            </div>
            <div>
              <span>Priority Gaps</span>
              <strong>{actualGapsCount}</strong>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon highlight-met">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span>Requirements Met</span>
              <strong>{metRequirementsCount}</strong>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <Award size={20} />
            </div>
            <div>
              <span>Transferable Skills</span>
              <strong>{transferableSkills.length}</strong>
            </div>
          </div>
        </section>

        {/* Section 1: Identified Skill Gaps */}
        <section className="analysis-block">
          <div className="block-header">
            <div className="block-icon">
              <Puzzle size={20} />
            </div>
            <div>
              <h2>Identified Skill Gaps</h2>
              <span>
                Comparison of your current skill level against target
                requirement
              </span>
            </div>
          </div>

          <div className="gaps-list">
            {skillGaps.map((gap, idx) => {
              const cfg = STATUS_CONFIG[gap.status] || STATUS_CONFIG.small_gap;
              const Icon = cfg.icon;

              return (
                <div key={idx} className="gap-card">
                  <div className="gap-card-top">
                    <div className="gap-title-group">
                      <h3>{gap.skill}</h3>
                      <span className={`status-badge ${cfg.badgeClass}`}>
                        <Icon size={13} />
                        {cfg.label}
                      </span>
                    </div>

                    <div className="level-comparison">
                      <div className="level-pill current">
                        <span>Current:</span>
                        <strong>{gap.current_level}</strong>
                      </div>
                      <span className="level-arrow">→</span>
                      <div className="level-pill required">
                        <span>Required:</span>
                        <strong>{gap.required_level}</strong>
                      </div>
                    </div>
                  </div>

                  <p className="gap-explanation">{gap.explanation}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2: Industry Required Skills */}
        <section className="analysis-block">
          <div className="block-header">
            <div className="block-icon">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2>Industry-Required Skills</h2>
              <span>
                Key competencies expected by industry for {gapData?.direction}
              </span>
            </div>
          </div>

          <div className="required-skills-grid">
            {requiredSkills.map((req, idx) => (
              <div key={idx} className="req-skill-card">
                <div className="req-card-top">
                  <h4>{req.skill}</h4>
                  <span className="req-level-tag">{req.required_level}</span>
                </div>

                <div className="importance-bar-wrap">
                  <div className="importance-labels">
                    <span>Industry Importance</span>
                    <strong>{req.importance}%</strong>
                  </div>
                  <div className="importance-track">
                    <div
                      className="importance-fill"
                      style={{ width: `${req.importance}%` }}
                    />
                  </div>
                </div>

                <p className="req-reason">{req.reason}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Two Column - Assessed Student Skills & Transferable Skills */}
        <div className="two-column-grid">
          {/* Current Assessed Capabilities */}
          <section className="analysis-block">
            <div className="block-header">
              <div className="block-icon">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h2>Your Assessed Skills</h2>
                <span>Evidence-backed assessment from your profile</span>
              </div>
            </div>

            <div className="assessment-list">
              {skillAssessments.map((item, idx) => (
                <div key={idx} className="assessment-item">
                  <div className="assessment-top">
                    <strong>{item.skill}</strong>
                    <span className="current-level-tag">
                      {item.current_level}
                    </span>
                  </div>
                  <p className="assessment-evidence">{item.evidence}</p>
                  <div className="assessment-meta">
                    <span>Basis: {item.assessment_basis}</span>
                    <span>Confidence: {item.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Transferable Skills */}
          <section className="analysis-block">
            <div className="block-header">
              <div className="block-icon">
                <Award size={20} />
              </div>
              <div>
                <h2>Transferable Skills</h2>
                <span>Skills from past experiences and interests</span>
              </div>
            </div>

            <div className="transferable-list">
              {transferableSkills.length > 0 ? (
                transferableSkills.map((item, idx) => (
                  <div key={idx} className="transferable-item">
                    <div className="transferable-top">
                      <strong>{item.skill}</strong>
                      <span className={`relevance-tag rel-${item.relevance}`}>
                        {item.relevance} relevance
                      </span>
                    </div>
                    <span className="transferable-source">
                      Source: {item.source}
                    </span>
                    <p className="transferable-exp">{item.explanation}</p>
                  </div>
                ))
              ) : (
                <p className="empty-notice">
                  No previous transferable skills recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Next Step / Roadmap CTA */}
        <section className="roadmap-cta-banner">
          <div>
            <span className="skill-gap-eyebrow">READY FOR THE NEXT STEP?</span>
            <h2>Personalized AI Learning Roadmap</h2>
            <p>
              Bridge these identified skill gaps step-by-step with a custom
              learning plan generated specifically for your target direction.
            </p>
          </div>

          <button
            className="action-btn primary large"
            onClick={() =>
              navigate("/student/roadmap", {
                state: { direction: gapData?.direction },
              })
            }
          >
            <Sparkles size={18} />
            Generate / View Roadmap
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
    </div>
  );
}

export default SkillGap;
