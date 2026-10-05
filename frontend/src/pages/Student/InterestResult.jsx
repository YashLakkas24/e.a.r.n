import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Landmark,
  Cpu,
  Code2,
  Briefcase,
  TrendingUp,
  Palette,
  HeartPulse,
  GraduationCap,
  Scale,
  Megaphone,
  Puzzle,
  Target,
  CheckCircle2,
} from "lucide-react";

import { getStudentInterestAnalysis } from "../../services/studentService";

import "./InterestResult.css";

const INTEREST_ICON_MAP = {
  "Government & Public Services": Landmark,
  "IT & Technology": Cpu,
  "Coding & Software": Code2,
  "Business & Entrepreneurship": Briefcase,
  Finance: TrendingUp,
  "Creative & Media": Palette,
  Healthcare: HeartPulse,
  Education: GraduationCap,
  Law: Scale,
  Marketing: Megaphone,
};

function InterestIcon({ interest, size = 25 }) {
  const Icon = INTEREST_ICON_MAP[interest] || Sparkles;
  return <Icon size={size} />;
}

function InterestResult() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialAnalysis = location.state?.analysis || null;
  const [analysisData, setAnalysisData] = useState(initialAnalysis);
  const [loading, setLoading] = useState(!initialAnalysis);
  const [error, setError] = useState("");

  /*
   * Get the currently logged-in student's ID.
   */
  const getStudentId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      return user.student_id || user.user_id || "STU001";
    } catch {
      return "STU001";
    }
  };

  /*
   * Fetch the real Interest+ analysis from FastAPI.
   */
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        if (!initialAnalysis) {
          setLoading(true);
        }
        setError("");

        const studentId = getStudentId();

        if (!studentId) {
          throw new Error("Student ID not found. Please login again.");
        }

        const data = await getStudentInterestAnalysis(studentId);

        if (data.has_analysis && data.analyses?.length) {
          setAnalysisData(data.analyses[0]);
        } else if (!initialAnalysis) {
          throw new Error(
            "Interest analysis is not available yet. Please complete the Interest+ discovery quiz.",
          );
        }
      } catch (err) {
        if (!initialAnalysis) {
          setError(err.message || "Failed to load interest analysis.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [initialAnalysis]);

  /*
   * Loading state
   */
  if (loading) {
    return (
      <div className="interest-result-page">
        <main className="result-main">
          <section className="state-card">
            <div className="analysis-icon">
              <Sparkles size={21} />
            </div>

            <h2>Loading your Interest+ analysis...</h2>

            <p>We're retrieving your personalized analysis.</p>
          </section>
        </main>
      </div>
    );
  }

  /*
   * Error state
   */
  if (error) {
    return (
      <div className="interest-result-page">
        <main className="result-main">
          <section className="state-card error">
            <h2>Unable to load your analysis</h2>

            <p>{error}</p>

            <button
              className="profile-button"
              onClick={() => navigate("/student/dashboard")}
            >
              Back to Dashboard
            </button>
          </section>
        </main>
      </div>
    );
  }

  const analysis = analysisData;

  if (!analysis) {
    return null;
  }

  const interestName = analysis.interest || "Interest";

  const skillGaps = analysis.skill_gaps || [];

  const directions = (analysis.potential_directions || []).map((direction) =>
    typeof direction === "string"
      ? {
          name: direction,
          fit_score: null,
          reason: "",
        }
      : direction,
  );

  return (
    <div className="interest-result-page">
      <header className="result-header">
        <button
          className="result-back"
          onClick={() => navigate("/student/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="result-brand">
          <Sparkles size={18} />
          Interest+
        </div>

        <span className="result-complete">
          <CheckCircle2 size={15} />
          Discovery complete
        </span>
      </header>

      <main className="result-main">
        {/* Heading */}

        <section className="result-intro">
          <span className="result-eyebrow">YOUR INTEREST PROFILE</span>

          <h1>
            Here's what we learned
            <br />
            about you.
          </h1>

          <p>
            This isn't a final career decision. It's a snapshot of your current
            interests, experience and areas worth exploring.
          </p>
        </section>

        {/* Main interest */}

        <section className="main-interest-card">
          <div className="main-interest-heading">
            <div className="main-interest-icon">
              <InterestIcon interest={interestName} size={25} />
            </div>

            <div>
              <span>PRIMARY INTEREST</span>
              <h2>{interestName}</h2>
            </div>
          </div>

          <div className="score-grid">
            {/* Interest */}

            <div className="score-item">
              <div className="score-title">
                <span>Interest</span>

                <strong>{analysis.interest_score}%</strong>
              </div>

              <div className="score-bar">
                <div
                  className="score-fill"
                  style={{
                    width: `${analysis.interest_score}%`,
                  }}
                />
              </div>
            </div>

            {/* Capability */}

            <div className="score-item">
              <div className="score-title">
                <span>Current Capability</span>

                <strong>{analysis.capability_score}%</strong>
              </div>

              <div className="score-bar">
                <div
                  className="score-fill capability"
                  style={{
                    width: `${analysis.capability_score}%`,
                  }}
                />
              </div>
            </div>

            {/* Experience */}

            <div className="score-item">
              <div className="score-title">
                <span>Experience</span>

                <strong>{analysis.experience_score}%</strong>
              </div>

              <div className="score-bar">
                <div
                  className="score-fill experience"
                  style={{
                    width: `${analysis.experience_score}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Analysis */}

        <section className="analysis-card">
          <div className="analysis-icon">
            <Sparkles size={21} />
          </div>

          <div>
            <span className="result-section-label">OUR ANALYSIS</span>

            <p>{analysis.analysis || analysis.summary}</p>
          </div>
        </section>

        {/* Two-column section */}

        <section className="result-two-column">
          {/* Skill gaps */}

          <div className="result-panel">
            <div className="panel-heading">
              <div className="panel-icon">
                <Puzzle size={20} />
              </div>

              <div>
                <span>DEVELOPMENT AREAS</span>
                <h2>Skills to develop</h2>
              </div>
            </div>

            <div className="skill-list">
              {skillGaps.length > 0 ? (
                skillGaps.map((skill) => (
                  <div
                    className="skill-item"
                    key={skill}
                  >
                    <span>{skill}</span>

                    <ArrowRight size={15} />
                  </div>
                ))
              ) : (
                <p>No specific skill gaps identified.</p>
              )}
            </div>
          </div>

          {/* Directions */}

          <div className="result-panel">
            <div className="panel-heading">
              <div className="panel-icon">
                <Target size={20} />
              </div>

              <div>
                <span>AREAS TO EXPLORE</span>
                <h2>Potential directions</h2>
              </div>
            </div>

            <div className="direction-list">
              {directions.length > 0 ? (
                directions.map((direction) => (
                  <div className="direction-item" key={direction.name}>
                    <div className="direction-icon">
                      <Target size={17} />
                    </div>

                    <div className="direction-info">
                      <strong>{direction.name}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <p>No potential directions available.</p>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}

        <section className="result-footer-card">
          <div>
            <span className="result-section-label">WHAT'S NEXT?</span>

            <h2>Your interest profile can evolve.</h2>

            <p>
              Explore your personalized skill gap analysis, compare your skills
              against industry standards, and generate an AI-powered learning
              roadmap.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              className="profile-button"
              onClick={() => navigate("/student/skills")}
            >
              <Puzzle size={17} style={{ marginRight: "6px" }} />
              Analyze Skill Gaps
              <ArrowRight size={17} style={{ marginLeft: "6px" }} />
            </button>

            <button
              className="profile-button"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
              onClick={() => navigate("/student/roadmap")}
            >
              <Sparkles size={17} style={{ marginRight: "6px" }} />
              View Roadmap
            </button>

            <button
              className="profile-button"
              style={{
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
              onClick={() => navigate("/student/dashboard")}
            >
              Dashboard
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default InterestResult;
