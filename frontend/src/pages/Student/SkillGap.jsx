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
    label: "Small Gap",
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
    label: "Needs Assessment",
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
  const [activeSection, setActiveSection] = useState("overview");

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
    // Core skill-gap analysis no longer waits for roadmap generation.
    // Allow for slow upstream model responses while polling the backend job.
    const deadline = Date.now() + 6 * 60 * 1000;
    let delayMs = 2000;

    while (Date.now() < deadline) {
      const res = await getStudentSkillGap(studentId, direction);

      if (res.status !== "processing") {
        if (res.status === "error") {
          throw new Error(res.detail || "Skill-gap analysis failed.");
        }
        return res;
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delayMs, remainingMs)),
      );
      delayMs = Math.min(Math.round(delayMs * 1.35), 5000);
    }

    throw new Error(
      "Skill-gap analysis is taking longer than expected. " +
        "The job may still be running; try again shortly.",
    );
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
            <h2>Assessing required skills and available evidence...</h2>
            <p>
              The analysis is identifying required skills and checking available evidence. Your learning roadmap is generated separately when you open it.
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

  const skillsToImproveCount = skillGaps.filter(
    (gap) => gap.status === "actual_gap" || gap.status === "small_gap",
  ).length;
  const skillsToVerifyCount = skillGaps.filter(
    (gap) => gap.status === "assessment_needed",
  ).length;
  const metRequirementsCount = skillGaps.filter(
    (gap) => gap.status === "no_gap",
  ).length;

  const normalizeSkillName = (value) =>
    String(value || "").trim().toLowerCase();

  const getRequirement = (skill) =>
    requiredSkills.find(
      (item) =>
        normalizeSkillName(item.skill) === normalizeSkillName(skill),
    );

  const getAssessment = (skill) =>
    skillAssessments.find(
      (item) =>
        normalizeSkillName(item.skill) === normalizeSkillName(skill),
    );

  const getImportance = (skill) => Number(getRequirement(skill)?.importance) || 0;

  const prioritySkills = [...skillGaps].sort((a, b) => {
    const rank = {
      actual_gap: 0,
      small_gap: 1,
      assessment_needed: 2,
      no_gap: 3,
    };
    return (
      (rank[a.status] ?? 4) - (rank[b.status] ?? 4) ||
      getImportance(b.skill) - getImportance(a.skill)
    );
  });

  const startSkill = prioritySkills[0];
  const startSkillRequirement = startSkill
    ? getRequirement(startSkill.skill)
    : null;

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
          <span className="skill-gap-eyebrow">CAREER DEVELOPMENT</span>
          <h1>Skill Gap Intelligence</h1>
          <p>
            Compare your current skills with AI-estimated requirements for
            your selected direction. Unknown means more evidence is needed,
            not that you lack the skill.
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

        {/* Selected Direction */}
        <section className="active-direction-card">
          <div className="direction-icon-wrap">
            <Layers size={24} />
          </div>
          <div className="direction-info-wrap">
            <span>SELECTED DIRECTION</span>
            <h2 title={gapData?.direction}>
              {gapData?.direction || "Career Path"}
            </h2>
            {gapData?.transition_difficulty && (
              <div className="transition-tag">
                <span>Estimated transition difficulty: </span>
                <strong className={"diff-" + gapData.transition_difficulty}>
                  {gapData.transition_difficulty.toUpperCase()}
                </strong>
              </div>
            )}
          </div>
          <button
            className="action-btn primary roadmap-inline-btn"
            onClick={() =>
              navigate("/student/roadmap", {
                state: { direction: gapData?.direction },
              })
            }
          >
            <Sparkles size={16} />
            View Roadmap
            <ArrowRight size={16} />
          </button>
        </section>

        {/* Primary Summary */}
        <section className="metrics-grid" aria-label="Skill summary">
          <div className="metric-card">
            <div className="metric-icon highlight-gap">
              <Flame size={20} />
            </div>
            <div>
              <span>Below Target</span>
              <strong>{skillsToImproveCount}</strong>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <HelpCircle size={20} />
            </div>
            <div>
              <span>Not Yet Assessed</span>
              <strong>{skillsToVerifyCount}</strong>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon highlight-met">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span>Meets Target</span>
              <strong>{metRequirementsCount}</strong>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <Award size={20} />
            </div>
            <div>
              <span>Relevant Strengths</span>
              <strong>{transferableSkills.length}</strong>
            </div>
          </div>
        </section>

        {/* Section Navigation */}
        <div className="skill-section-tabs" role="tablist" aria-label="Skill analysis sections">
          <button
            type="button"
            id="tab-overview"
            role="tab"
            aria-selected={activeSection === "overview"}
            aria-controls="panel-overview"
            className={"skill-section-tab" + (activeSection === "overview" ? " active" : "")}
            onClick={() => setActiveSection("overview")}
          >
            <Layers size={17} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            id="tab-skills"
            role="tab"
            aria-selected={activeSection === "skills"}
            aria-controls="panel-skills"
            className={"skill-section-tab" + (activeSection === "skills" ? " active" : "")}
            onClick={() => setActiveSection("skills")}
          >
            <Puzzle size={17} />
            <span>Skill Gaps &amp; Requirements</span>
            <span className="tab-count">{skillGaps.length}</span>
          </button>

          <button
            type="button"
            id="tab-strengths"
            role="tab"
            aria-selected={activeSection === "strengths"}
            aria-controls="panel-strengths"
            className={"skill-section-tab" + (activeSection === "strengths" ? " active" : "")}
            onClick={() => setActiveSection("strengths")}
          >
            <Award size={17} />
            <span>Transferable Strengths</span>
            <span className="tab-count">{transferableSkills.length}</span>
          </button>
        </div>

        {/* Overview Panel */}
        {activeSection === "overview" && (
          <section
            className="section-panel"
            id="panel-overview"
            role="tabpanel"
            aria-labelledby="tab-overview"
          >
            <div className="overview-section-heading">
              <div>
                <h2>Your current position</h2>
                <p>A quick view of what to improve, verify, and build on.</p>
              </div>
              <button
                type="button"
                className="text-action"
                onClick={() => setActiveSection("skills")}
              >
                Review all skills <ArrowRight size={15} />
              </button>
            </div>

            {startSkill ? (
              <section className="overview-start-card">
                <div className="overview-start-icon">
                  <TrendingUp size={21} />
                </div>
                <div className="overview-start-content">
                  <span className="skill-gap-eyebrow">SUGGESTED STARTING POINT</span>
                  <h3>{startSkill.skill}</h3>
                  <p>
                    {startSkill.status === "assessment_needed"
                      ? "Your current level is not established yet. Gather evidence before deciding whether training is needed."
                      : startSkill.status === "actual_gap"
                        ? "This skill is below the target level and is a priority for development."
                        : startSkill.status === "small_gap"
                          ? "You have a foundation in this skill. Focus on closing the remaining gap to the target."
                          : "This skill appears to meet the target. Review its supporting evidence if needed."}
                  </p>
                  <div className="overview-start-meta">
                    <span className={"status-badge " + (STATUS_CONFIG[startSkill.status] || STATUS_CONFIG.assessment_needed).badgeClass}>
                      {(STATUS_CONFIG[startSkill.status] || STATUS_CONFIG.assessment_needed).label}
                    </span>
                    {startSkillRequirement && (
                      <span className="importance-inline">
                        AI-estimated importance: <strong>{startSkillRequirement.importance}/100</strong>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="action-btn secondary"
                  onClick={() => setActiveSection("skills")}
                >
                  Explore skills <ArrowRight size={15} />
                </button>
              </section>
            ) : (
              <div className="empty-notice">
                No skill analysis is available for this direction yet.
              </div>
            )}

            <div className="overview-section-heading priorities-heading">
              <div>
                <h2>Priority skills</h2>
                <p>Start with the highest-priority items in your assessment.</p>
              </div>
            </div>

            <div className="overview-priority-list">
              {prioritySkills.slice(0, 3).map((skill, idx) => {
                const config =
                  STATUS_CONFIG[skill.status] || STATUS_CONFIG.assessment_needed;
                const requirement = getRequirement(skill.skill);

                return (
                  <button
                    type="button"
                    key={skill.skill + "-" + idx}
                    className="overview-priority-row"
                    onClick={() => setActiveSection("skills")}
                  >
                    <span className="priority-rank">{idx + 1}</span>
                    <span className="priority-skill-name">{skill.skill}</span>
                    <span className={"status-badge " + config.badgeClass}>
                      {config.label}
                    </span>
                    <span className="importance-inline">
                      {requirement ? requirement.importance + "/100 importance" : "Importance unavailable"}
                    </span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
              {prioritySkills.length === 0 && (
                <p className="empty-notice">No skills to display yet.</p>
              )}
            </div>
          </section>
        )}

        {/* Combined Skill Gaps and Requirements Panel */}
        {activeSection === "skills" && (
          <section
            className="section-panel"
            id="panel-skills"
            role="tabpanel"
            aria-labelledby="tab-skills"
          >
            <div className="overview-section-heading">
              <div>
                <h2>Skill gaps &amp; requirements</h2>
                <p>
                  Select a skill to inspect its status, evidence, importance,
                  and target level. Unknown means not yet assessed.
                </p>
              </div>
            </div>

            <div className="gaps-list">
              {prioritySkills.map((gap, idx) => {
                const config =
                  STATUS_CONFIG[gap.status] || STATUS_CONFIG.assessment_needed;
                const requirement = getRequirement(gap.skill);
                const assessment = getAssessment(gap.skill);
                const explanation = (gap.explanation || "").trim();
                const evidence = (assessment?.evidence || "").trim();
                const normalizedExplanation = normalizeSkillName(explanation);
                const normalizedEvidence = normalizeSkillName(evidence);
                const showSeparateEvidence =
                  evidence &&
                  normalizedEvidence !== normalizedExplanation &&
                  !normalizedExplanation.includes(normalizedEvidence);

                return (
                  <details
                    key={gap.skill + "-" + idx}
                    className="gap-card skill-detail-card"
                  >
                    <summary className="skill-row-summary">
                      <div className="skill-row-main">
                        <div className="skill-row-title">
                          <h3>{gap.skill}</h3>
                          <span className={"status-badge " + config.badgeClass}>
                            {config.label}
                          </span>
                        </div>

                        <div className="level-comparison">
                          <span className="level-pill current">
                            <span>Current</span>
                            <strong>{gap.current_level || "unknown"}</strong>
                          </span>
                          <span className="level-arrow">→</span>
                          <span className="level-pill required">
                            <span>Target</span>
                            <strong>{gap.required_level}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="skill-row-importance">
                        <span className="importance-label">AI-estimated importance</span>
                        <strong>
                          {requirement ? requirement.importance + "/100" : "—"}
                        </strong>
                      </div>
                    </summary>

                    <div className="gap-detail-content">
                      {explanation && <p>{explanation}</p>}

                      {showSeparateEvidence && (
                        <p>
                          <strong>Supporting evidence: </strong>
                          {evidence}
                        </p>
                      )}

                      <div className="gap-detail-meta">
                        <span>
                          Assessment basis:{" "}
                          <strong>{assessment?.assessment_basis || "unknown"}</strong>
                        </span>
                        <span>
                          Confidence:{" "}
                          <strong>{assessment?.confidence || "unknown"}</strong>
                        </span>
                      </div>

                      {requirement?.reason && (
                        <p>
                          <strong>Why it matters: </strong>
                          {requirement.reason}
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}

              {skillGaps.length === 0 && (
                <p className="empty-notice">No skill-gap results are available yet.</p>
              )}
            </div>
          </section>
        )}

        {/* Transferable Strengths Panel */}
        {activeSection === "strengths" && (
          <section
            className="section-panel"
            id="panel-strengths"
            role="tabpanel"
            aria-labelledby="tab-strengths"
          >
            <div className="overview-section-heading">
              <div>
                <h2>Transferable strengths &amp; relevant background</h2>
                <p>
                  Existing skills, experience, interests, or motivations that
                  may help with this direction. Interests are not proof of a
                  demonstrated skill.
                </p>
              </div>
            </div>

            <div className="transferable-grid">
              {transferableSkills.map((item, idx) => (
                <details
                  key={item.skill + "-" + idx}
                  className="transferable-item strength-detail-card"
                >
                  <summary className="strength-summary">
                    <span className="strength-name">{item.skill}</span>
                    <span className={"relevance-tag rel-" + item.relevance}>
                      {item.relevance} relevance
                    </span>
                  </summary>
                  <div className="transferable-detail-content">
                    <span className="transferable-source">
                      Source: {item.source}
                    </span>
                    <p className="transferable-exp">{item.explanation}</p>
                  </div>
                </details>
              ))}

              {transferableSkills.length === 0 && (
                <p className="empty-notice">
                  No transferable strengths have been identified yet.
                </p>
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

export default SkillGap;
