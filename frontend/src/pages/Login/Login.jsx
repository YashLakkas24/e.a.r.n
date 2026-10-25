import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Button from "../../components/Button/Button";
import { submitLogin } from "../../services/authService";
import "./Login.css";

/**
 * Login page.
 *
 * `role` is local component state — "student" or "teacher" — controlled by
 * the segmented toggle. Both ID + Password inputs always stay mounted on
 * the same card; only their labels/placeholders and the submit button text
 * change based on `role`. This matches the spec: it is ONE login page with
 * a role switch, not two separate pages.
 */
function Login() {
  const navigate = useNavigate();

  const [role, setRole] = useState("student");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isStudent = role === "student";
  const idLabel = isStudent ? "Student ID" : "Teacher ID";
  const idPlaceholder = isStudent
    ? "Enter your student ID"
    : "Enter your teacher ID";

  const handleRoleChange = (nextRole) => {
    if (nextRole === role) return;
    setRole(nextRole);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");

    if (!id.trim() || !password.trim()) {
      setError(`Please enter your ${idLabel.toLowerCase()} and password.`);
      return;
    }

    setLoading(true);

    try {
      const result = await submitLogin(role, id, password);
      navigate(result.redirectTo);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__glow" aria-hidden="true" />

      <a
        href="/"
        className="login-page__brand"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        <span className="navbar__mark" aria-hidden="true">
          <Activity size={18} strokeWidth={2.4} />
        </span>
        <span>E.A.R.N</span>
      </a>

      <div className="login-card">
        <h1 className="login-card__title">Welcome back</h1>

        <p className="login-card__subtitle">
          Sign in to continue to your Academic Early Warning workspace.
        </p>

        {/* ---------- Role toggle ---------- */}
        <div
          className="role-toggle"
          role="tablist"
          aria-label="Select account type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isStudent}
            className={`role-toggle__option ${
              isStudent ? "role-toggle__option--active" : ""
            }`}
            onClick={() => handleRoleChange("student")}
          >
            Student
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={!isStudent}
            className={`role-toggle__option ${
              !isStudent ? "role-toggle__option--active" : ""
            }`}
            onClick={() => handleRoleChange("teacher")}
          >
            Teacher
          </button>

          <span
            className="role-toggle__thumb"
            style={{
              transform: isStudent ? "translateX(0%)" : "translateX(100%)",
            }}
            aria-hidden="true"
          />
        </div>

        <h2 className="login-card__mode-heading">
          {isStudent ? "Student Login" : "Teacher Login"}
        </h2>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <div className="field-label-row">
              <label htmlFor="login-id">{idLabel}</label>

              <span className="demo-credential">
                Available IDs:{" "}
                <span className="demo-credential__value">
                  {isStudent ? "STU001 - STU080" : "TCH001 - TCH005"}
                </span>
              </span>
            </div>

            <input
              id="login-id"
              name="id"
              type="text"
              autoComplete="username"
              placeholder={idPlaceholder}
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <div className="field-label-row">
              <label htmlFor="login-password">Password</label>

              <span className="demo-credential">
                Available Passwords:{" "}
                <span className="demo-credential__value">
                  {isStudent
                    ? "student001 - student080"
                    : "teacher001 - teacher005"}
                </span>
              </span>
            </div>

            <div className="password-input">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />

              <button
                type="button"
                className="password-input__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="login-form__error" role="alert" aria-live="polite">
            {error && (
              <span className="login-form__error-text">
                <AlertCircle size={14} />
                {error}
              </span>
            )}
          </div>

          <Button
            type="submit"
            size="large"
            fullWidth
            loading={loading}
            icon={!loading ? <ArrowRight size={17} /> : null}
          >
            {loading
              ? "Signing in…"
              : `Sign In as ${isStudent ? "Student" : "Teacher"}`}
          </Button>
        </form>

        <p className="login-card__footnote">
          Credentials are issued by your institution. Contact your department if
          you don&apos;t have one yet.
        </p>

        {/* ---------- Back to Home ---------- */}
        <Button
          variant="ghost"
          size="medium"
          fullWidth
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate("/")}
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}

export default Login;
