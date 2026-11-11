import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Code2,
  Compass,
  Gamepad2,
  Map,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  getStudentCareerDirections,
  getStudentInterestAnalysis,
} from "../../services/studentService";
import "./CareerPathExplorer.css";

function getStudentId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.student_id || user.user_id || "";
  } catch {
    return "";
  }
}

function getPathIcon(directionName) {
  const name = String(directionName || "").toLowerCase();
  if (name.includes("machine learning") || name.includes("artificial intelligence") || name.startsWith("ai ")) return BrainCircuit;
  if (name.includes("game")) return Gamepad2;
  if (name.includes("data") || name.includes("analytics") || name.includes("statistics")) return ChartNoAxesCombined;
  if (name.includes("software") || name.includes("backend") || name.includes("developer") || name.includes("program") || name.includes("engineer")) return Code2;
  if (name.includes("policy") || name.includes("public") || name.includes("community") || name.includes("government") || name.includes("civil service") || name.includes("administration")) return BriefcaseBusiness;
  return Compass;
}

function normalizeDirections(directions) {
  if (!Array.isArray(directions)) return [];
  return directions
    .map((direction) =>
      typeof direction === "string"
        ? { name: direction, fit_score: null, reason: "", pathway_summary: "", pathway_type: "other", official_resources: [] }
        : direction,
    )
    .filter((direction) => typeof direction?.name === "string" && direction.name.trim())
    .sort((a, b) => (Number(b.fit_score) || 0) - (Number(a.fit_score) || 0));
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

  const loadDirections = async (forceRefresh = false) => {
    const result = await getStudentCareerDirections(studentId, forceRefresh);
    if (!result.has_analysis) {
      setNeedsInterest(true);
      setDirections([]);
      setInterest(result.interest || "");
      setError(result.message || "Complete Interest+ first to discover career pathways.");
      return;
    }
    setNeedsInterest(false);
    setError("");
    setInterest(result.interest || "");
    setDirections(normalizeDirections(result.directions));
  };

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      if (!studentId) {
        setError("Student information is missing. Please sign in again.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        try {
          const interestResult = await getStudentInterestAnalysis(studentId);
          if (!cancelled && interestResult.has_analysis && interestResult.analyses?.length) {
            setInterest(interestResult.analyses[0].interest || "");
          }
        } catch {
          // The career-directions endpoint remains the source of truth.
        }
        const result = await getStudentCareerDirections(studentId, false);
        if (cancelled) return;
        if (!result.has_analysis) {
          setNeedsInterest(true);
          setDirections([]);
          setInterest(result.interest || "");
          setError(result.message || "Complete Interest+ first to discover career pathways.");
        } else {
          setNeedsInterest(false);
          setError("");
          setInterest(result.interest || "");
          setDirections(normalizeDirections(result.directions));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load career recommendations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInitialData();
    return () => { cancelled = true; };
  }, [studentId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await loadDirections(true);
    } catch (err) {
      setError(err.message || "Could not refresh career recommendations.");
    } finally {
      setRefreshing(false);
    }
  };

  const openPath = (direction) => {
    navigate("/student/roadmap", {
      state: { direction: direction.name, careerPath: direction },
    });
  };

  if (loading) {
    return (
      <div className="career-explorer-page">
        <header className="career-explorer-header">
          <button className="career-explorer-back" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft size={17} /> Dashboard
          </button>
          <div className="career-explorer-brand"><Compass size={19} /><span>Career Pathways</span></div>
          <span />
        </header>
        <main className="career-explorer-main">
          <section className="career-explorer-loading">
            <div className="career-explorer-spinner" />
            <h2>Generating your career pathways...</h2>
            <p>We are matching your Interest+ results with relevant career roles and their typical entry routes.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="career-explorer-page">
      <header className="career-explorer-header">
        <button className="career-explorer-back" onClick={() => navigate("/student/dashboard")}>
          <ArrowLeft size={17} /> Dashboard
        </button>
        <div className="career-explorer-brand"><Compass size={19} /><span>Career Pathways</span></div>
        <button className="career-explorer-refresh" type="button" onClick={handleRefresh} disabled={refreshing || needsInterest}>
          <RefreshCw size={14} className={refreshing ? "career-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh paths"}
        </button>
      </header>

      <main className="career-explorer-main">
        <section className="career-explorer-intro">
          <span className="career-explorer-eyebrow">INTEREST → CAREER OPTIONS → ENTRY ROUTE</span>
          <h1>Explore careers that match your interests</h1>
          <p>E.A.R.N. recommends relevant occupational roles based on your Interest+ analysis. Select a role to explore its typical qualifications, examinations or admissions, skill gaps, and career-entry roadmap.</p>
        </section>

        {interest && (
          <section className="career-interest-context">
            <div className="career-interest-icon"><Target size={20} /></div>
            <div><span>BASED ON YOUR INTEREST PROFILE</span><strong>{interest}</strong></div>
          </section>
        )}

        {error && (
          <div className="career-explorer-alert" role="alert">
            <p>{error}</p>
            {needsInterest && (
              <button className="career-explorer-primary" type="button" onClick={() => navigate("/student/interest")}>
                Complete Interest+ <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        {!needsInterest && directions.length > 0 && (
          <section className="career-paths-section">
            <div className="career-paths-heading">
              <div>
                <span className="career-explorer-eyebrow">CAREER OPTIONS</span>
                <h2>Choose a career to explore</h2>
                <p>Ranked by interest alignment. Fit scores are exploratory indicators, not employment or selection probabilities.</p>
              </div>
              <span className="career-path-count">{directions.length} paths</span>
            </div>

            <div className="career-path-grid">
              {directions.map((direction, index) => {
                const Icon = getPathIcon(direction.name);
                const score = direction.fit_score == null ? null : Math.max(0, Math.min(100, Number(direction.fit_score) || 0));
                return (
                  <article className="career-path-card" key={direction.name}>
                    <div className="career-path-card-top">
                      <div className="career-path-icon"><Icon size={22} /></div>
                      <span className="career-path-number">OPTION {String(index + 1).padStart(2, "0")}</span>
                    </div>
                    {direction.pathway_type && (
                      <div className="career-path-status-row">
                        <span className="pathway-type-tag">{String(direction.pathway_type).replaceAll("_", " ")}</span>
                      </div>
                    )}
                    <h3>{direction.name}</h3>
                    <p className="career-path-reason">{direction.reason || "Related to your Interest+ profile."}</p>

                    {direction.pathway_summary && (
                      <div className="entry-route-summary">
                        <span>Typical entry route</span>
                        <p>{direction.pathway_summary}</p>
                      </div>
                    )}

                    {Array.isArray(direction.official_resources) && direction.official_resources.length > 0 && (
                      <div className="official-resource-list">
                        {direction.official_resources.slice(0, 3).map((resource) => (
                          <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">
                            {resource.label}<ArrowRight size={13} />
                          </a>
                        ))}
                      </div>
                    )}

                    {score !== null && (
                      <div className="career-fit">
                        <div className="career-fit-label">
                          <span>Interest fit</span><strong>{score}/100</strong>
                        </div>
                        <div className="career-fit-track" role="img" aria-label={`Interest fit score: ${score} out of 100`}>
                          <span style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="career-path-card-footer">
                      <span>Explore the typical entry route and skill roadmap.</span>
                      <button className="career-path-open" type="button" onClick={() => openPath(direction)}>
                        View career roadmap <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!needsInterest && directions.length === 0 && !error && (
          <section className="career-explorer-empty">
            <div className="career-path-icon"><Map size={22} /></div>
            <h3>No career paths available yet</h3>
            <p>Refresh recommendations to discover roles related to your interests.</p>
            <button className="career-explorer-primary" type="button" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Generate career paths"} <ArrowRight size={16} />
            </button>
          </section>
        )}

        <aside className="career-explorer-note">
          <Sparkles size={18} aria-hidden="true" />
          <p><strong>Important:</strong> Career recommendations are exploratory guidance, not guarantees of admission, employment, or selection. Requirements vary by role and recruitment cycle. Verify formal qualifications and current rules through the linked official sources.</p>
        </aside>
      </main>
    </div>
  );
}

export default CareerPathExplorer;
