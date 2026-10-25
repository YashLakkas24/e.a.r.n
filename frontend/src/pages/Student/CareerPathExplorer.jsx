import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleHelp,
  Code2,
  Compass,
  Gamepad2,
  GraduationCap,
  Map,
  RefreshCw,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import {
  getStudentCareerDirections,
  getStudentCareerEligibilityProfile,
  getStudentInterestAnalysis,
  saveStudentCareerEligibilityProfile,
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

const DEFAULT_PROFILE = {
  age: "",
  highest_qualification: "unknown",
  education_status: "unknown",
  field_of_study: "",
  current_study_year: "",
  expected_graduation_year: "",
  state_or_ut: "",
  citizenship_status: "unknown",
  age_or_marks_relaxation: "unknown",
  willing_to_pursue_further_study: true,
  willing_to_prepare_for_competitive_exams: true,
  preferred_entry_timeline: "unknown",
};

const ELIGIBILITY_META = {
  possible_now: {
    label: "Possible now",
    className: "eligibility-possible-now",
    Icon: CheckCircle2,
    detail: "Your supplied profile appears compatible with the baseline entry route. Verify the latest official notice before applying.",
  },
  possible_after_graduation: {
    label: "Possible after graduation",
    className: "eligibility-after-graduation",
    Icon: GraduationCap,
    detail: "Complete the stated qualification milestone, then recheck the current entry requirements.",
  },
  additional_qualification_required: {
    label: "Further qualification required",
    className: "eligibility-additional-qualification",
    Icon: CalendarClock,
    detail: "This route appears to require further education, certification, or another prerequisite before entry.",
  },
  needs_more_information: {
    label: "Needs more information",
    className: "eligibility-needs-information",
    Icon: CircleHelp,
    detail: "E.A.R.N. cannot assess this route confidently until more profile details or official requirements are verified.",
  },
  not_possible: {
    label: "NOT POSSIBLE",
    className: "eligibility-not-possible",
    Icon: AlertTriangle,
    detail: "A known eligibility barrier appears to block this route under the supplied profile. Check the linked official rules before ruling it out.",
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

  if (name.includes("machine learning") || name.includes("artificial intelligence") || name.startsWith("ai ")) {
    return BrainCircuit;
  }
  if (name.includes("game") || name.includes("gameplay")) return Gamepad2;
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
        ? {
            name: direction,
            fit_score: null,
            reason: "",
            pathway_summary: "",
            pathway_type: "other",
            eligibility_status: "needs_more_information",
            eligibility_reason: "The saved recommendation predates eligibility assessment. Refresh the career paths.",
            missing_information: ["Refresh career recommendations"],
            official_resources: [],
          }
        : direction,
    )
    .filter((direction) => typeof direction.name === "string" && direction.name.trim())
    .sort((a, b) => {
      const statusDifference =
        (STATUS_ORDER[a.eligibility_status] ?? 3) -
        (STATUS_ORDER[b.eligibility_status] ?? 3);
      return statusDifference || (Number(b.fit_score) || 0) - (Number(a.fit_score) || 0);
    });
}

function CareerPathExplorer() {
  const navigate = useNavigate();
  const studentId = getStudentId();

  const [interest, setInterest] = useState("");
  const [directions, setDirections] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState(DEFAULT_PROFILE);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [needsInterest, setNeedsInterest] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const counts = useMemo(() => ({
    possibleNow: directions.filter((item) => item.eligibility_status === "possible_now").length,
    later: directions.filter((item) =>
      ["possible_after_graduation", "additional_qualification_required"].includes(item.eligibility_status),
    ).length,
    needsInfo: directions.filter((item) => item.eligibility_status === "needs_more_information").length,
    notPossible: directions.filter((item) => item.eligibility_status === "not_possible").length,
  }), [directions]);

  const visibleDirections = useMemo(() => {
    if (activeFilter === "all") return directions;
    return directions.filter((item) => item.eligibility_status === activeFilter);
  }, [directions, activeFilter]);

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
        // Load the interest label independently so the eligibility form still
        // tells the student which Interest+ result is being used.
        try {
          const interestResult = await getStudentInterestAnalysis(studentId);
          if (cancelled) return;
          if (interestResult.has_analysis && interestResult.analyses?.length) {
            setInterest(interestResult.analyses[0].interest || "");
          }
        } catch {
          // Interest label is supplementary; eligibility/profile loading can continue.
        }

        const profileResult = await getStudentCareerEligibilityProfile(studentId);
        if (cancelled) return;

        if (profileResult.has_profile && profileResult.profile) {
          const saved = { ...DEFAULT_PROFILE, ...profileResult.profile };
          setProfile(saved);
          setProfileDraft(saved);
          setShowProfileForm(false);

          const careerResult = await getStudentCareerDirections(studentId, false);
          if (cancelled) return;
          if (!careerResult.has_analysis) {
            setNeedsInterest(true);
            setDirections([]);
            setError(careerResult.message || "Complete Interest+ first.");
          } else {
            setNeedsInterest(false);
            setError("");
            setInterest(careerResult.interest || "");
            setDirections(normalizeDirections(careerResult.directions));
          }
        } else {
          setProfile(null);
          setProfileDraft(DEFAULT_PROFILE);
          setShowProfileForm(true);
          // Do not rank careers before the student has had a chance to provide
          // eligibility information.
          setDirections([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load your career profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const updateDraft = (key, value) => {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");

    const payload = {
      ...profileDraft,
      age: profileDraft.age === "" ? null : Number(profileDraft.age),
      current_study_year: profileDraft.current_study_year === ""
        ? null
        : Number(profileDraft.current_study_year),
      expected_graduation_year: profileDraft.expected_graduation_year === ""
        ? null
        : Number(profileDraft.expected_graduation_year),
    };

    try {
      const saved = await saveStudentCareerEligibilityProfile(studentId, payload);
      const normalized = { ...DEFAULT_PROFILE, ...(saved.profile || payload) };
      setProfile(normalized);
      setProfileDraft(normalized);
      setShowProfileForm(false);
      await loadDirections(false);
    } catch (err) {
      setError(err.message || "Could not save your eligibility profile.");
    } finally {
      setSavingProfile(false);
    }
  };

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
          <button className="career-explorer-back" onClick={() => navigate("/student/dashboard")}>
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
            <h2>Assessing your career entry routes...</h2>
            <p>We are using your interest profile and any eligibility details you supplied to compare realistic pathways.</p>
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
          <span>Career Pathways</span>
        </div>
        <button
          className="career-explorer-refresh"
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || !profile}
          title="Reassess career pathways using your saved profile"
        >
          <RefreshCw size={14} className={refreshing ? "career-spin" : ""} />
          {refreshing ? "Reassessing..." : "Refresh paths"}
        </button>
      </header>

      <main className="career-explorer-main">
        <section className="career-explorer-intro">
          <span className="career-explorer-eyebrow">INTEREST → REALISTIC CAREER OPTIONS → ENTRY ROUTE</span>
          <h1>Which careers can you realistically pursue?</h1>
          <p>
            E.A.R.N. ranks relevant roles by preliminary eligibility and interest
            fit. Each selected path opens a practical sequence of qualifications,
            exams or admissions, applications, and skill development.
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

        {showProfileForm ? (
          <section className="eligibility-profile-panel">
            <div className="eligibility-panel-heading">
              <div className="career-path-icon"><GraduationCap size={22} /></div>
              <div>
                <span className="career-explorer-eyebrow">STEP 1 · YOUR CURRENT SITUATION</span>
                <h2>Check which pathways are realistic for you</h2>
                <p>
                  These details help distinguish possible-now routes, routes that
                  require graduation or further study, and routes that need more
                  information. Unknown details will not be treated as failures.
                </p>
              </div>
            </div>

            <form className="eligibility-profile-form" onSubmit={handleSaveProfile}>
              <div className="eligibility-form-grid">
                <label>
                  Age
                  <input
                    type="number"
                    min="14"
                    max="100"
                    value={profileDraft.age ?? ""}
                    onChange={(event) => updateDraft("age", event.target.value)}
                    placeholder="e.g. 20"
                  />
                  <small>Leave blank if you prefer; some exam rules depend on age.</small>
                </label>

                <label>
                  Highest qualification completed
                  <select
                    value={profileDraft.highest_qualification}
                    onChange={(event) => updateDraft("highest_qualification", event.target.value)}
                  >
                    <option value="unknown">Not specified</option>
                    <option value="below_10th">Below Class 10</option>
                    <option value="10th">Class 10</option>
                    <option value="12th">Class 12</option>
                    <option value="diploma">Diploma</option>
                    <option value="undergraduate">Bachelor's degree</option>
                    <option value="postgraduate">Postgraduate degree</option>
                    <option value="other">Other qualification</option>
                  </select>
                </label>

                <label>
                  Current study status
                  <select
                    value={profileDraft.education_status}
                    onChange={(event) => updateDraft("education_status", event.target.value)}
                  >
                    <option value="unknown">Not specified</option>
                    <option value="studying">Currently studying</option>
                    <option value="completed">Completed current qualification</option>
                    <option value="not_studying">Not currently studying</option>
                  </select>
                </label>

                <label>
                  Course / field of study
                  <input
                    type="text"
                    maxLength="160"
                    value={profileDraft.field_of_study || ""}
                    onChange={(event) => updateDraft("field_of_study", event.target.value)}
                    placeholder="e.g. B.E. Artificial Intelligence"
                  />
                </label>

                <label>
                  Current year of study
                  <select
                    value={profileDraft.current_study_year ?? ""}
                    onChange={(event) => updateDraft("current_study_year", event.target.value)}
                  >
                    <option value="">Not specified</option>
                    {[1, 2, 3, 4, 5, 6].map((year) => (
                      <option key={year} value={year}>{year}{year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} year</option>
                    ))}
                  </select>
                </label>

                <label>
                  Expected graduation year
                  <input
                    type="number"
                    min="2020"
                    max="2045"
                    value={profileDraft.expected_graduation_year ?? ""}
                    onChange={(event) => updateDraft("expected_graduation_year", event.target.value)}
                    placeholder="e.g. 2027"
                  />
                </label>

                <label>
                  Preferred state / region
                  <input
                    type="text"
                    maxLength="100"
                    value={profileDraft.state_or_ut || ""}
                    onChange={(event) => updateDraft("state_or_ut", event.target.value)}
                    placeholder="e.g. Maharashtra or All India"
                  />
                </label>

                <label>
                  Citizenship status
                  <select
                    value={profileDraft.citizenship_status}
                    onChange={(event) => updateDraft("citizenship_status", event.target.value)}
                  >
                    <option value="unknown">Not specified</option>
                    <option value="indian_citizen">Indian citizen</option>
                    <option value="other_citizenship">Other / not an Indian citizen</option>
                  </select>
                </label>

                <label>
                  May an age or marks relaxation apply?
                  <select
                    value={profileDraft.age_or_marks_relaxation}
                    onChange={(event) => updateDraft("age_or_marks_relaxation", event.target.value)}
                  >
                    <option value="unknown">Not sure / prefer not to say</option>
                    <option value="yes">Possibly yes</option>
                    <option value="no">No</option>
                  </select>
                  <small>No personal category is requested. If relaxation could affect eligibility, the result may need verification.</small>
                </label>

                <label>
                  When would you prefer to enter this career?
                  <select
                    value={profileDraft.preferred_entry_timeline}
                    onChange={(event) => updateDraft("preferred_entry_timeline", event.target.value)}
                  >
                    <option value="unknown">Not specified</option>
                    <option value="as_soon_as_eligible">As soon as eligible</option>
                    <option value="after_graduation">After graduation</option>
                    <option value="within_3_years">Within 3 years</option>
                    <option value="flexible">Flexible timeline</option>
                  </select>
                </label>
              </div>

              <div className="eligibility-preferences">
                <label className="eligibility-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(profileDraft.willing_to_pursue_further_study)}
                    onChange={(event) => updateDraft("willing_to_pursue_further_study", event.target.checked)}
                  />
                  <span>I'm open to further study or professional qualifications.</span>
                </label>
                <label className="eligibility-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(profileDraft.willing_to_prepare_for_competitive_exams)}
                    onChange={(event) => updateDraft("willing_to_prepare_for_competitive_exams", event.target.checked)}
                  />
                  <span>I'm open to preparing for competitive recruitment exams.</span>
                </label>
              </div>

              <div className="eligibility-profile-actions">
                <button className="career-explorer-primary" type="submit" disabled={savingProfile}>
                  <Save size={16} />
                  {savingProfile ? "Assessing..." : "Save profile & rank pathways"}
                  <ArrowRight size={16} />
                </button>
                {profile && (
                  <button className="career-explorer-secondary" type="button" onClick={() => {
                    setProfileDraft(profile);
                    setShowProfileForm(false);
                  }}>
                    Cancel
                  </button>
                )}
              </div>

              <p className="eligibility-disclaimer">
                Eligibility results are preliminary guidance, not an official
                decision. Current notifications and programme rules take
                precedence. E.A.R.N. will show “Needs more information” rather
                than “NOT POSSIBLE” when a required fact is missing.
              </p>
            </form>
          </section>
        ) : profile && (
          <section className="career-profile-summary">
            <div>
              <span className="career-explorer-eyebrow">ELIGIBILITY PROFILE SAVED</span>
              <strong>
                {profile.highest_qualification === "unknown"
                  ? "Qualification not specified"
                  : profile.highest_qualification.replaceAll("_", " ")}
                {profile.education_status === "studying" ? " · currently studying" : ""}
                {profile.age ? ` · age ${profile.age}` : ""}
              </strong>
              <p>Career paths are ranked using these details. Update them if your situation changes.</p>
            </div>
            <button className="career-explorer-secondary" type="button" onClick={() => setShowProfileForm(true)}>
              Update profile
            </button>
          </section>
        )}

        {!showProfileForm && profile && !needsInterest && directions.length > 0 && (
          <section className="career-paths-section">
            <div className="career-paths-heading">
              <div>
                <span className="career-explorer-eyebrow">PRIORITIZED PATHWAYS</span>
                <h2>Choose a realistic route</h2>
                <p>
                  Paths likely to be actionable now appear first; paths requiring
                  more qualification or verification follow. A hard eligibility
                  barrier is shown last.
                </p>
              </div>
              <span className="career-path-count">{directions.length} paths</span>
            </div>

            <div className="pathway-count-strip">
              <button type="button" className={activeFilter === "all" ? "active" : ""} onClick={() => setActiveFilter("all")}>
                All <strong>{directions.length}</strong>
              </button>
              <button type="button" className={activeFilter === "possible_now" ? "active" : ""} onClick={() => setActiveFilter("possible_now")}>
                Possible now <strong>{counts.possibleNow}</strong>
              </button>
              <button type="button" className={activeFilter === "possible_after_graduation" ? "active" : ""} onClick={() => setActiveFilter("possible_after_graduation")}>
                After graduation <strong>{directions.filter((item) => item.eligibility_status === "possible_after_graduation").length}</strong>
              </button>
              <button type="button" className={activeFilter === "additional_qualification_required" ? "active" : ""} onClick={() => setActiveFilter("additional_qualification_required")}>
                Further study <strong>{directions.filter((item) => item.eligibility_status === "additional_qualification_required").length}</strong>
              </button>
              <button type="button" className={activeFilter === "needs_more_information" ? "active" : ""} onClick={() => setActiveFilter("needs_more_information")}>
                Needs info <strong>{counts.needsInfo}</strong>
              </button>
              <button type="button" className={activeFilter === "not_possible" ? "active" : ""} onClick={() => setActiveFilter("not_possible")}>
                Not possible <strong>{counts.notPossible}</strong>
              </button>
            </div>

            <div className="career-path-grid">
              {visibleDirections.map((direction, index) => {
                const Icon = getPathIcon(direction.name);
                const score = direction.fit_score == null
                  ? null
                  : Math.max(0, Math.min(100, Number(direction.fit_score) || 0));
                const status = ELIGIBILITY_META[direction.eligibility_status] || ELIGIBILITY_META.needs_more_information;
                const StatusIcon = status.Icon;
                const isNotPossible = direction.eligibility_status === "not_possible";

                return (
                  <article className={`career-path-card ${isNotPossible ? "career-path-card-blocked" : ""}`} key={direction.name}>
                    <div className="career-path-card-top">
                      <div className="career-path-icon"><Icon size={22} /></div>
                      <span className="career-path-number">OPTION {String(index + 1).padStart(2, "0")}</span>
                    </div>

                    <div className="career-path-status-row">
                      <span className={`eligibility-badge ${status.className}`}>
                        <StatusIcon size={14} />
                        {status.label}
                      </span>
                      {direction.pathway_type && (
                        <span className="pathway-type-tag">
                          {String(direction.pathway_type).replaceAll("_", " ")}
                        </span>
                      )}
                    </div>

                    <h3>{direction.name}</h3>
                    <p className="career-path-reason">{direction.reason || "Related to your interest profile."}</p>

                    {direction.eligibility_reason && (
                      <div className={`eligibility-explanation ${isNotPossible ? "blocked" : ""}`}>
                        {isNotPossible && <AlertTriangle size={16} />}
                        <p>{direction.eligibility_reason}</p>
                      </div>
                    )}

                    {direction.pathway_summary && (
                      <div className="entry-route-summary">
                        <span>Typical entry route</span>
                        <p>{direction.pathway_summary}</p>
                      </div>
                    )}

                    {Array.isArray(direction.missing_information) && direction.missing_information.length > 0 && (
                      <div className="missing-facts">
                        <strong>Still to verify</strong>
                        <ul>
                          {direction.missing_information.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(direction.official_resources) && direction.official_resources.length > 0 && (
                      <div className="official-resource-list">
                        {direction.official_resources.slice(0, 2).map((resource) => (
                          <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">
                            {resource.label}
                            <ArrowRight size={13} />
                          </a>
                        ))}
                      </div>
                    )}

                    {score !== null && (
                      <div className="career-fit">
                        <div className="career-fit-label">
                          <span>Interest fit (not success probability)</span>
                          <strong>{score}/100</strong>
                        </div>
                        <div className="career-fit-track" role="img" aria-label={`Exploration fit score: ${score} out of 100`}>
                          <span style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="career-path-card-footer">
                      <span>{status.detail}</span>
                      <button className="career-path-open" type="button" onClick={() => openPath(direction)}>
                        {isNotPossible ? "Review eligibility barrier" : "View entry roadmap"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleDirections.length === 0 && (
              <div className="career-explorer-empty">
                <h3>No pathways in this category</h3>
                <p>Try another eligibility filter.</p>
              </div>
            )}
          </section>
        )}

        {!showProfileForm && profile && directions.length === 0 && !needsInterest && !error && (
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
          <p>
            <strong>Important:</strong> these are ranked career options, not a
            guarantee of selection. “NOT POSSIBLE” should only appear for a
            documented hard barrier. The linked official portals help you check
            current notices; this screen does not claim that a vacancy or
            application window is currently open. Verify eligibility against the
            relevant official notification or admissions page before deciding.
          </p>
        </aside>
      </main>
    </div>
  );
}

export default CareerPathExplorer;
