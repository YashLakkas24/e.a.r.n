import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import TeacherHeader from "../../components/teacher/TeacherHeader";
import {
  getTeacherProfile,
  uploadStudentCSV,
} from "../../services/teacherService";
import { logout } from "../../services/authService";

import "./teacher.css";

export default function TeacherWelcome() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  const [loggingOut, setLoggingOut] = useState(false);

  // =========================================================
  // CSV UPLOAD STATE
  // =========================================================

  const fileInputRef = useRef(null);

  // Selected CSV file
  const [selectedFile, setSelectedFile] = useState(null);

  // Upload status
  const [uploading, setUploading] = useState(false);

  // Upload error
  const [uploadError, setUploadError] = useState("");

  // Controls the success popup
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  // Controls whether the other teacher actions are visible
  const [uploadCompleted, setUploadCompleted] = useState(false);

  // =========================================================
  // LOAD TEACHER PROFILE
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");

    getTeacherProfile()
      .then((data) => {
        if (cancelled) return;

        setProfile(data);
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;

        console.error("Failed to load teacher profile:", error);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================================================
  // OPEN FILE PICKER
  // =========================================================

  const handleUploadClick = () => {
    if (uploading) return;

    fileInputRef.current?.click();
  };

  // =========================================================
  // HANDLE CSV SELECTION + ACTUAL BACKEND UPLOAD
  // =========================================================

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    // Only CSV files are allowed
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please select a CSV file.");

      event.target.value = "";

      return;
    }

    try {
      setUploading(true);
      setUploadError("");

      // Store selected file for UI
      setSelectedFile(file);

      // IMPORTANT:
      // This actually sends the CSV to FastAPI.
      await uploadStudentCSV(file);

      // Only show success after backend confirms upload
      setShowUploadSuccess(true);

    } catch (error) {
      console.error("CSV upload failed:", error);

      // Upload did not succeed
      setSelectedFile(null);

      setUploadError(
        error?.message ||
        "CSV upload failed. Please try again."
      );

      event.target.value = "";

    } finally {
      setUploading(false);
    }
  };

  // =========================================================
  // CONTINUE AFTER SUCCESS POPUP
  // =========================================================

  const handleUploadContinue = () => {
    setShowUploadSuccess(false);

    // Reveal teacher actions
    setUploadCompleted(true);
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);

      await logout();

      navigate("/", { replace: true });

    } catch (error) {
      console.error("Logout failed:", error);

      navigate("/", { replace: true });

    } finally {
      setLoggingOut(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="teacher-shell">
      <div className="teacher-shell-inner">

        {/* =================================================
            TEACHER HEADER
            ================================================= */}

        <TeacherHeader
          profile={status === "ready" ? profile : null}
        />

        {/* =================================================
            LOGOUT BUTTON
            ================================================= */}

        <button
          type="button"
          className="logout-btn"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>

        {/* =================================================
            WELCOME HERO
            ================================================= */}

        <div className="welcome-hero view-transition">

          <span className="welcome-eyebrow">
            E.A.R.N
          </span>

          <h1 className="welcome-heading">
            Turn Academic Signals Into Action
          </h1>

          <p className="welcome-subheading">
            Review class-wide risk patterns, understand why students need
            support, and act early — before a decline becomes a crisis.
          </p>

          {/* =================================================
              PROFILE LOADING
              ================================================= */}

          {status === "loading" && (
            <div style={{ marginBottom: 32 }}>

              <div
                className="skeleton skeleton-line"
                style={{
                  width: 260,
                  height: 16,
                }}
              />

              <div
                className="skeleton"
                style={{
                  width: "100%",
                  height: 88,
                  borderRadius: 16,
                  marginTop: 14,
                }}
              />

            </div>
          )}

          {/* =================================================
              PROFILE ERROR
              ================================================= */}

          {status === "error" && (
            <div
              className="state-card error"
              style={{
                marginBottom: 28,
                textAlign: "left",
              }}
            >
              <div className="state-title">
                Unable to load your profile.
              </div>

              <div className="state-body">
                Please try again.
              </div>
            </div>
          )}

          {/* =================================================
              PROFILE
              ================================================= */}

          {status === "ready" && profile && (
            <>
              <div className="welcome-greeting">
                Welcome, <b>Professor {profile.teacher_name}</b>
              </div>

              <div className="profile-card">

                <div className="profile-card-field">
                  <div className="profile-card-label">
                    Teacher Name
                  </div>

                  <div className="profile-card-value">
                    {profile.teacher_name}
                  </div>
                </div>

                <div className="profile-card-field">
                  <div className="profile-card-label">
                    Teacher ID
                  </div>

                  <div className="profile-card-value">
                    {profile.teacher_id}
                  </div>
                </div>

                <div className="profile-card-field">
                  <div className="profile-card-label">
                    Department
                  </div>

                  <div className="profile-card-value">
                    {profile.department}
                  </div>
                </div>

              </div>
            </>
          )}

          {/* =================================================
              CSV FILE INPUT
              ================================================= */}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {/* =================================================
              CSV UPLOAD ERROR
              ================================================= */}

          {uploadError && (
            <div
              className="state-card error"
              style={{
                marginTop: 20,
                textAlign: "left",
              }}
            >
              <div className="state-title">
                CSV Upload Failed
              </div>

              <div className="state-body">
                {uploadError}
              </div>
            </div>
          )}

          {/* =================================================
              BEFORE CSV IS UPLOADED
              ================================================= */}

          {!uploadCompleted && !showUploadSuccess && (
            <div
              style={{
                marginTop: 28,
                display: "flex",
                justifyContent: "center",
              }}
            >

              <button
                type="button"
                className="cta-btn"
                onClick={handleUploadClick}
                disabled={uploading}
              >
                {uploading
                  ? "Uploading..."
                  : "Upload Student CSV"}

                {!uploading && (
                  <span className="arrow">
                    ↑
                  </span>
                )}
              </button>

            </div>
          )}

          {/* =================================================
              AFTER CSV UPLOAD
              ================================================= */}

          {uploadCompleted && (
            <>
              {/* Uploaded file indicator */}

              <div
                style={{
                  marginTop: 24,
                  marginBottom: 20,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    padding: "11px 18px",
                    borderRadius: 12,
                    border: "1px solid var(--border-medium)",
                    background: "var(--surface-secondary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                  }}
                >

                  <span style={{ fontSize: 18 }}>
                    📄
                  </span>

                  <span>
                    Student report:{" "}
                    <b>
                      {selectedFile?.name}
                    </b>
                  </span>

                </div>
              </div>

              {/* =================================================
                  TEACHER ACTION BUTTONS
                  ================================================= */}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >

                {/* Show Analytics */}

                <button
                  type="button"
                  className="cta-btn"
                  onClick={() =>
                    navigate("/teacher/analytics")
                  }
                >
                  Show Analytics

                  <span className="arrow">
                    →
                  </span>
                </button>

                {/* Upload Notice */}

                <button
                  type="button"
                  className="cta-btn"
                  onClick={() =>
                    navigate("/teacher/notices")
                  }
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-medium)",
                    color: "var(--text-primary)",
                  }}
                >
                  Upload Notice

                  <span className="arrow">
                    →
                  </span>
                </button>

                {/* Notice History */}

                <button
                  type="button"
                  className="cta-btn"
                  onClick={() =>
                    navigate("/teacher/notice-history")
                  }
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-medium)",
                    color: "var(--text-primary)",
                  }}
                >
                  Notice History

                  <span className="arrow">
                    →
                  </span>
                </button>

              </div>
            </>
          )}

        </div>
      </div>

      {/* =====================================================
          UPLOAD SUCCESS POPUP
          ===================================================== */}

      {showUploadSuccess && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >

          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "var(--surface-primary)",
              borderRadius: 24,
              padding: "38px 30px 30px",
              textAlign: "center",
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.25)",
              animation:
                "uploadSuccessPop 0.25s ease-out",
            }}
          >

            {/* Success Tick */}

            <div
              style={{
                width: 76,
                height: 76,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 42,
                fontWeight: 700,
                boxShadow:
                  "0 8px 25px rgba(34, 197, 94, 0.3)",
              }}
            >
              ✓
            </div>

            {/* Title */}

            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              CSV Uploaded Successfully
            </h2>

            {/* Description */}

            <p
              style={{
                margin: "0 auto 8px",
                fontSize: 15,
                lineHeight: 1.6,
                opacity: 0.75,
              }}
            >
              Your student report is ready for analysis.
            </p>

            {/* File Name */}

            <div
              style={{
                margin: "18px 0 24px",
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--surface-secondary)",
                fontSize: 14,
                wordBreak: "break-word",
              }}
            >
              📄 <b>{selectedFile?.name}</b>
            </div>

            {/* Continue */}

            <button
              type="button"
              className="cta-btn"
              onClick={handleUploadContinue}
              style={{
                width: "100%",
                justifyContent: "center",
              }}
            >
              Continue

              <span className="arrow">
                →
              </span>
            </button>

          </div>
        </div>
      )}

      {/* =====================================================
          SUCCESS POPUP ANIMATION
          ===================================================== */}

      <style>
        {`
          @keyframes uploadSuccessPop {
            0% {
              opacity: 0;
              transform: scale(0.85);
            }

            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>

    </div>
  );
}