import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Sparkles,
  SlidersHorizontal,
  Puzzle,
  Compass,
  LogOut,
  GraduationCap,
  Save,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

import {
  getStudentPreferences,
  updateStudentPreferences,
} from "../../services/studentService";

import "./StudentPreferences.css";

function StudentPreferences() {
  const navigate = useNavigate();

  // ============================================================
  // CURRENT USER
  // ============================================================

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const studentId = savedUser.student_id || savedUser.user_id || "";

  const studentName = savedUser.full_name || "Student";

  // ============================================================
  // STATE
  // ============================================================

  const [preferences, setPreferences] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ============================================================
  // LOAD EXISTING PREFERENCES
  // ============================================================

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      if (!studentId) {
        if (isMounted) {
          setError("Student ID not found. Please log in again.");
          setLoading(false);
        }

        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getStudentPreferences(studentId);

        if (isMounted) {
          setPreferences(data.preferences || "");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Could not load your notice preferences.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // ============================================================
  // SAVE PREFERENCES
  // ============================================================

  const handleSave = async () => {
    if (!studentId) {
      setError("Student ID not found. Please log in again.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      await updateStudentPreferences(studentId, preferences);

      setMessage("Preferences saved. Your notice feed has been refreshed.");
    } catch (err) {
      setError(err.message || "Could not save your notice preferences.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CLEAR PREFERENCES
  // ============================================================

  const handleClear = () => {
    setPreferences("");
    setMessage("");
    setError("");
  };

  // ============================================================
  // SIDEBAR NAVIGATION
  // ============================================================

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/student/dashboard",
    },
    {
      id: "interest",
      label: "Interest+",
      icon: Sparkles,
      badge: "AI",
      path: "/student/interest",
    },
    {
      id: "preferences",
      label: "Preferences",
      icon: SlidersHorizontal,
      path: "/student/preferences",
    },
    {
      id: "skills",
      label: "Skill Gaps",
      icon: Puzzle,
      path: "/student/skills",
    },
    {
      id: "roadmap",
      label: "AI Roadmap",
      icon: Compass,
      path: "/student/roadmap",
    },
  ];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="student-preferences-page">
      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside className="student-sidebar">
        <div className="student-brand">
          <div className="student-brand-icon">
            <GraduationCap size={22} />
          </div>

          <div>
            <h2>Student</h2>
            <span>Workspace</span>
          </div>
        </div>

        <nav className="student-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                className={`student-nav-item ${
                  item.id === "preferences" ? "active" : ""
                } ${item.id === "interest" ? "interest-nav" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={19} />

                <span>{item.label}</span>

                {item.badge && (
                  <span className="interest-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="student-sidebar-bottom">
          <button
            type="button"
            className="student-nav-item logout-item"
            onClick={() => {
              localStorage.removeItem("user");
              localStorage.removeItem("firebase_id_token");

              navigate("/");
            }}
          >
            <LogOut size={19} />

            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="student-main preferences-main">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="student-header">
          <div>
            <span className="student-eyebrow">STUDENT WORKSPACE</span>

            <h1>Notice Preferences</h1>

            <p>
              Tell E.A.R.N. what kinds of college opportunities and notices you
              want to see.
            </p>
          </div>

          <div className="student-profile-mini">
            <div className="student-avatar">
              {studentName.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{studentName}</strong>
              <span>{studentId}</span>
            </div>
          </div>
        </header>

        {/* ====================================================
            PREFERENCES CARD
        ==================================================== */}

        <section className="preferences-card">
          <div className="preferences-card-heading">
            <div className="preferences-icon">
              <SlidersHorizontal size={23} />
            </div>

            <div>
              <span className="section-label">PERSONALIZED NOTICES</span>

              <h2>What should we look for?</h2>
            </div>
          </div>

          <p className="preferences-description">
            Write the topics, activities, events and opportunities that interest
            you. E.A.R.N. uses these preferences to personalize your college
            notice feed.
          </p>

          {/* ==================================================
              EXAMPLES
          ================================================== */}

          <div className="preferences-examples">
            <span>Examples</span>

            <p>
              AI and machine learning, internships, hackathons, coding
              competitions, research opportunities, workshops, scholarships.
            </p>
          </div>

          {/* ==================================================
              LOADING
          ================================================== */}

          {loading ? (
            <div className="preferences-loading">
              Loading your preferences...
            </div>
          ) : (
            <>
              {/* ==============================================
                  TEXTAREA
              ============================================== */}

              <textarea
                className="preferences-textarea"
                value={preferences}
                maxLength={2000}
                onChange={(event) => {
                  setPreferences(event.target.value);
                  setMessage("");
                  setError("");
                }}
                placeholder="Example: I am interested in AI internships, hackathons, coding competitions, machine learning workshops and research opportunities."
                disabled={saving}
              />

              {/* ==============================================
                  TEXTAREA META
              ============================================== */}

              <div className="preferences-meta">
                <span>{preferences.length}/2000 characters</span>

                <span>
                  These preferences control notice personalization only.
                </span>
              </div>

              {/* ==============================================
                  SUCCESS MESSAGE
              ============================================== */}

              {message && (
                <div className="preferences-success">
                  <CheckCircle2 size={16} />

                  <span>{message}</span>
                </div>
              )}

              {/* ==============================================
                  ERROR MESSAGE
              ============================================== */}

              {error && (
                <div className="preferences-error">
                  <span>{error}</span>
                </div>
              )}

              {/* ==============================================
                  ACTIONS
              ============================================== */}

              <div className="preferences-actions">
                <button
                  type="button"
                  className="preferences-clear"
                  onClick={handleClear}
                  disabled={saving || preferences.length === 0}
                >
                  <RotateCcw size={15} />
                  Clear
                </button>

                <button
                  type="button"
                  className="preferences-save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save size={16} />

                  {saving ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </>
          )}
        </section>

        {/* ====================================================
            INFORMATION CARD
        ==================================================== */}

        <section className="preferences-info">
          <div className="preferences-info-icon">
            <Sparkles size={18} />
          </div>

          <div>
            <strong>Preferences are independent from Interest+</strong>

            <p>
              Your Interest+ results, Skill Gaps and AI Roadmap describe your
              career exploration. Notice Preferences are only used to determine
              which college notices and opportunities are relevant to you.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default StudentPreferences;
