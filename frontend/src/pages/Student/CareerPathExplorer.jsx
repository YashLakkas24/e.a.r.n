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
  getStudentCareerEligibility,
  saveStudentCareerEligibility,
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

  const feasibilityPriority = {
    feasible: 0,
    needs_preparation: 1,
    eligibility_unconfirmed: 2,
    not_possible: 3,
  };

  return directions
    .map((direction) =>
      typeof direction === "string"
        ? {
            name: direction,
            fit_score: null,
            reason: "",
            feasibility_status: "eligibility_unconfirmed",
          }
        : {
            ...direction,
            feasibility_status:
              direction.feasibility_status || "eligibility_unconfirmed",
          },
    )
    .filter((direction) => typeof direction.name === "string" && direction.name.trim())
    .sort((a, b) => {
      const statusOrder =
        (feasibilityPriority[a.feasibility_status] ?? 2) -
        (feasibilityPriority[b.feasibility_status] ?? 2);
      return statusOrder || (Number(b.fit_score) || 0) - (Number(a.fit_score) || 0);
    });
}

function getFeasibilityLabel(status) {
  switch (status) {
    case "feasible":
      return "Good route fit";
    case "needs_preparation":
      return "Preparation required";
    case "not_possible":
      return "NOT POSSIBLE";
    default:
      return "Eligibility to verify";
  }
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
  const [eligibilityProfile, setEligibilityProfile] = useState(null);
  const [needsEligibility, setNeedsEligibility] = useState(false);
  const [editingEligibility, setEditingEligibility] = useState(false);
  const [savingEligibility, setSavingEligibility] = useState(false);
  const [eligibilityError, setEligibilityError] = useState("");
  const [eligibilityForm, setEligibilityForm] = useState({
    age: "",
    highest_qualification: "class_12",
    study_stream: "not_sure",
    citizenship: "indian",
    state: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPaths() {
      setLoading(true);
      setError("");

      try {
        const profileResult = await getStudentCareerEligibility(studentId);
        if (cancelled) return;

        if (!profileResult.has_profile) {
          setNeedsEligibility(true);
          setEligibilityProfile(null);
          setDirections([]);
          return;
        }

        setEligibilityProfile(profileResult.profile);
        setEligibilityForm(profileResult.profile);
        setNeedsEligibility(false);

        // Refresh once so cached role priorities use the saved eligibility profile.
        const refreshKey = `earn-career-paths-v3:${studentId}`;
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
      sessionStorage.setItem(`earn-career-paths-v3:${studentId}`, "done");
    } catch (err) {
      setError(err.message || "Could not refresh career path recommendations.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleEligibilitySubmit = async (event) => {
    event.preventDefault();
    setSavingEligibility(true);
    setEligibilityError("");
    setError("");

    try {
      const saved = await saveStudentCareerEligibility(studentId, {
        ...eligibilityForm,
        age: Number(eligibilityForm.age),
      });
      setEligibilityProfile(saved.profile);
      setNeedsEligibility(false);
      setEditingEligibility(false);
      setLoading(true);

      try {
        const result = await getStudentCareerDirections(studentId, true);
        if (!result.has_analysis) {
          setNeedsInterest(true);
          setDirections([]);
          setError(result.message || "Complete Interest+ to discover career paths.");
        } else {
          setNeedsInterest(false);
          setInterest(result.interest || "");
          setDirections(normalizeDirections(result.directions));
          sessionStorage.setItem(`earn-career-paths-v3:${studentId}`, "done");
        }
      } catch (err) {
        setError(
          `Profile saved, but career roles could not be ranked: ${
            err.message || "Please try refreshing the paths."
          }`,
        );
      }
    } catch (err) {
      setEligibilityError(err.message || "Could not save eligibility details.");
    } finally {
      setSavingEligibility(false);
      setLoading(false);
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
          disabled={refreshing || !eligibilityProfile}
          title="Generate fresh career path suggestions"
        >
          <RefreshCw size={14} className={refreshing ? "career-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh paths"}
        </button>
      </header>

      <main className="career-explorer-main">
        <section className="career-explorer-intro">
          <span className="career-explorer-eyebrow">YOUR INTERESTS, MULTIPLE POSSIBILITIES</span>
          <h1>Explore India-focused career routes.</h1>
          <p>
            Compare roles connected to your interest, ranked by fit and route
            feasibility. Open a role to see the qualifications, admissions,
            exams, and preparation steps that may lead there.
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

        {/* {eligibilityProfile && !editingEligibility && (
          <section className="career-eligibility-summary">
            <div>
              <span>ROUTE SCREENING PROFILE</span>
              <p>
                Age {eligibilityProfile.age} ·{" "}
                {eligibilityProfile.highest_qualification.replaceAll("_", " ")} ·{" "}
                {eligibilityProfile.study_stream.replaceAll("_", " ")}
                {eligibilityProfile.state ? ` · ${eligibilityProfile.state}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="career-eligibility-edit"
              onClick={() => {
                setEligibilityForm(eligibilityProfile);
                setEditingEligibility(true);
              }}
            >
              Edit profile
            </button>
          </section>
        )}

        {(needsEligibility || editingEligibility) && (
          <form className="career-eligibility-form" onSubmit={handleEligibilitySubmit}>  
            <div>
              <span className="career-explorer-eyebrow">PERSONALIZE ROUTE FEASIBILITY</span>
              <h2>Tell us what affects your eligibility</h2>
              <p>
                These details help order routes and flag requirements to check.
                Your profile is private to your account. Recommendations are
                guidance—not official eligibility decisions.
              </p>
            </div>

            <div className="career-eligibility-fields">
              <label>
                Age
                <input
                  type="number"
                  min="14"
                  max="80"
                  required
                  value={eligibilityForm.age}
                  onChange={(event) =>
                    setEligibilityForm({ ...eligibilityForm, age: event.target.value })
                  }
                />
              </label>
              <label>
                Highest qualification
                <select
                  value={eligibilityForm.highest_qualification}
                  onChange={(event) =>
                    setEligibilityForm({
                      ...eligibilityForm,
                      highest_qualification: event.target.value,
                    })
                  }
                >
                  <option value="class_10_or_below">Class 10 or below</option>
                  <option value="class_12">Class 12</option>
                  <option value="diploma">Diploma</option>
                  <option value="bachelors">Bachelor's degree</option>
                  <option value="masters">Master's degree</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Study stream
                <select
                  value={eligibilityForm.study_stream}
                  onChange={(event) =>
                    setEligibilityForm({
                      ...eligibilityForm,
                      study_stream: event.target.value,
                    })
                  }
                >
                  <option value="science">Science</option>
                  <option value="commerce">Commerce</option>
                  <option value="arts_humanities">Arts / Humanities</option>
                  <option value="engineering_technical">Engineering / Technical</option>
                  <option value="other">Other</option>
                  <option value="not_sure">Not sure</option>
                </select>
              </label>
              <label>
                Citizenship
                <select
                  value={eligibilityForm.citizenship}
                  onChange={(event) =>
                    setEligibilityForm({
                      ...eligibilityForm,
                      citizenship: event.target.value,
                    })
                  }
                >
                  <option value="indian">Indian citizen</option>
                  <option value="other">Other citizenship</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </label>
              <label>
                State / UT (optional)
                <input
                  type="text"
                  maxLength="80"
                  value={eligibilityForm.state}
                  onChange={(event) =>
                    setEligibilityForm({ ...eligibilityForm, state: event.target.value })
                  }
                />
              </label>
            </div>

            {eligibilityError && (
              <p className="career-eligibility-error" role="alert">
                {eligibilityError}
              </p>
            )}
            <div className="career-eligibility-actions">
              <button
                className="career-explorer-primary"
                type="submit"
                disabled={savingEligibility}  
              >
                {savingEligibility ? "Saving profile..." : "Save and rank my roles"}
                <ArrowRight size={16} />
              </button>
              {editingEligibility && (
                <button
                  className="career-eligibility-edit"
                  type="button"
                  onClick={() => setEditingEligibility(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )} */}

        <section className="career-paths-section">
          <div className="career-paths-heading">
            <div>
              <span className="career-explorer-eyebrow">INDIA · PRIORITIZED FOR YOUR PROFILE</span>
              <h2>Career roles to explore</h2>
              <p>
                Select a role to open its qualification, admission, exam, and
                preparation sequence. Routes with known eligibility barriers
                appear last.
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
                        PRIORITY {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <h3>{direction.name}</h3>
                    <span
                      className={`career-feasibility-badge feasibility-${direction.feasibility_status}`}
                    >
                      {getFeasibilityLabel(direction.feasibility_status)}
                    </span>
                    <p className="career-path-reason">
                      {direction.reason ||
                        "Suggested for exploration based on your interest profile."}
                    </p>
                    {direction.feasibility_reason && (
                      <p
                        className={`career-feasibility-reason feasibility-reason-${direction.feasibility_status}`}
                      >
                        {direction.feasibility_reason}
                      </p>
                    )}

                    {score !== null && (
                      <div className="career-fit">
                        <div className="career-fit-label">
                          <span>Interest fit</span>
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
          ) : needsEligibility ? (
            <div className="career-explorer-empty">
              <h3>Complete your route profile to get ranked roles</h3>
              <p>
                Add a few eligibility details above. We will then prioritize
                suitable India-focused career routes and show uncertain
                requirements clearly.
              </p>
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
            These are India-focused role recommendations, not live job
            vacancies. Each route is guidance only: confirm current exam and
            admission requirements with the official authority before acting.
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
