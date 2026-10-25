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

function getPathIcon(directionName) {
  const name = String(directionName || "").toLowerCase();

  if (name.includes("machine learning") || name.includes("artificial intelligence") || name.startsWith("ai ")) {
    return BrainCircuit;
  }

  if (name.includes("game") || name.includes("gameplay")) {
    return Gamepad2;
  }

  if (name.includes("data") || name.includes("analytics") || name.includes("statistics")) {
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
    name.includes("government")
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
    .filter((direction) => typeof direction.name === "string" && direction.name.trim())
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

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPaths() {
      setLoading(true);
      setError("");

      try {
        // Refresh cached legacy suggestions once per browser tab session so
        // the new role-focused prompt takes effect without repeated AI calls
        // every time the student returns to this screen.
        const refreshKey = `earn-career-paths-v2:${studentId}`;
        const shouldRefresh = sessionStorage.getItem(refreshKey) !== "done";
        const result = await getStudentCareerDirections(studentId, shouldRefresh);

        if (cancelled) return;

        if (!result.has_analysis) {
          setNeedsInterest(true);
          setDirections([]);
          setInterest("");
          setError(result.message || "Complete Interest+ to discover career paths.");
          return;
        }

        setNeedsInterest(false);
        setInterest(result.interest || "");
        setDirections(normalizeDirections(result.directions));

        if (shouldRefresh) {
          sessionStorage.setItem(refreshKey, "done");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load career path recommendations.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!studentId) {
      setError("Student information is missing. Please sign in again.");
      setLoading(false);
    } else {
      loadInitialPaths();
    }

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
        setError(result.message || "Complete Interest+ to discover career paths.");
        return;
      }

      setNeedsInterest(false);
      setInterest(result.interest || "");
      setDirections(normalizeDirections(result.directions));
      sessionStorage.setItem(`earn-career-paths-v2:${studentId}`, "done");
    } catch (err) {
      setError(err.message || "Could not refresh career path recommendations.");
    } finally {
      setRefreshing(false);
    }
  };

  const openPath = (direction) => {
    navigate("/student/roadmap", {
      state: { direction: direction.name },
    });
  };

  if (loading) {
    return (
      <div className="career-explorer-page">
        <header className="career-explorer-header">
          <button className="career-explorer-back" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <div className="career-explorer-brand">
            <Compass size={19} />
            <span>Career Path Explorer</span>
          </div>
          <span />
        </header>
        <main className="career-explorer-main">
          <section className="career-explorer-loading">
            <div className="career-explorer-spinner" />
            <h2>Finding career paths for your interests...</h2>
            <p>We are matching your interest profile and available experience to roles worth exploring.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="career-explorer-page">
      <header className="career-explorer-header">
        <button className="career-explorer-back" onClick={() => navigate("/student/dashboard")}>
          <ArrowLeft size={17} />
          Dashboard
        </button>
        <div className="career-explorer-brand">
          <Compass size={19} />
          <span>Career Path Explorer</span>
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
          <span className="career-explorer-eyebrow">YOUR INTERESTS, MULTIPLE POSSIBILITIES</span>
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
            {!needsInterest && directions.length > 0 && (
              <span className="career-explorer-alert-note">
                The recommendations currently displayed are still available.
              </span>
            )}
          </div>
        )}

        <section className="career-paths-section">
          <div className="career-paths-heading">
            <div>
              <span className="career-explorer-eyebrow">PERSONALIZED EXPLORATION</span>
              <h2>Career paths to explore</h2>
              <p>
                Select a path to open its personalized roadmap. You can explore
                different paths without committing to one career.
              </p>
            </div>
            <span className="career-path-count">{directions.length} paths</span>
          </div>

          {directions.length > 0 ? (
            <div className="career-path-grid">
              {directions.map((direction, index) => {
                const Icon = getPathIcon(direction.name);
                const score =
                  direction.fit_score == null
                    ? null
                    : Math.max(0, Math.min(100, Number(direction.fit_score) || 0));

                return (
                  <article className="career-path-card" key={direction.name}>
                    <div className="career-path-card-top">
                      <div className="career-path-icon">
                        <Icon size={22} />
                      </div>
                      <span className="career-path-number">
                        PATH {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <h3>{direction.name}</h3>
                    <p className="career-path-reason">
                      {direction.reason ||
                        "Suggested for exploration based on your interest profile."}
                    </p>

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

                    <button
                      className="career-path-open"
                      type="button"
                      onClick={() => openPath(direction)}
                    >
                      Explore this path
                      <ArrowRight size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="career-explorer-empty">
              <div className="career-path-icon">
                <Map size={22} />
              </div>
              <h3>No career paths available yet</h3>
              <p>
                Complete your Interest+ profile, or refresh recommendations to
                discover roles related to your interests.
              </p>
              <button
                className="career-explorer-primary"
                type="button"
                onClick={needsInterest ? () => navigate("/student/interest") : handleRefresh}
                disabled={refreshing}
              >
                {needsInterest ? "Complete Interest+" : "Generate career paths"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>

        <aside className="career-explorer-note">
          <BookOpenIcon />
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

function BookOpenIcon() {
  return <Sparkles size={18} aria-hidden="true" />;
}

export default CareerPathExplorer;
