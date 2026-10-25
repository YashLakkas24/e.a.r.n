import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  FileText,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import TeacherHeader from "../../components/teacher/TeacherHeader";
import { getTeacherProfile } from "../../services/teacherService";
import { getAllNotices } from "../../api/notifications";

import "./NoticeHistory.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function NoticeHistory() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [notices, setNotices] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([getTeacherProfile(), getAllNotices()])
      .then(([profileData, noticeData]) => {
        if (cancelled) return;

        setProfile(profileData);
        setNotices(noticeData.notices || []);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;

        console.error("Failed to load notice history:", err);
        setError(err.message || "Failed to load notices.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="notice-history-page">
      <div className="teacher-shell-inner">
        <TeacherHeader profile={profile} />

        <button
          type="button"
          className="notice-history-back"
          onClick={() => navigate("/teacher/dashboard")}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <section className="notice-history-hero">
          <span className="notice-history-eyebrow">
            NOTICE & INTERVENTION SYSTEM
          </span>

          <h1>Notice History</h1>

          <p>View all college notices that have been uploaded to E.A.R.N.</p>
        </section>

        {status === "loading" && (
          <div className="notice-history-state">Loading notices...</div>
        )}

        {status === "error" && (
          <div className="notice-history-state error">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="notice-history-summary">
              <div>
                <span>Total Notices</span>
                <strong>{notices.length}</strong>
              </div>

              <div>
                <span>Mandatory</span>
                <strong>
                  {notices.filter((notice) => notice.is_mandatory).length}
                </strong>
              </div>
            </div>

            {notices.length === 0 ? (
              <div className="notice-history-empty">
                <FileText size={28} />

                <h3>No notices uploaded yet</h3>

                <p>Once a teacher publishes a notice, it will appear here.</p>

                <button onClick={() => navigate("/teacher/notices")}>
                  Upload First Notice
                </button>
              </div>
            ) : (
              <div className="notice-history-list">
                {notices.map((notice) => (
                  <article className="notice-history-card" key={notice.id}>
                    <div className="notice-history-card-top">
                      <div className="notice-history-icon">
                        <FileText size={21} />
                      </div>

                      <div className="notice-history-meta">
                        {notice.is_mandatory ? (
                          <span className="notice-badge mandatory">
                            MANDATORY
                          </span>
                        ) : (
                          <span className="notice-badge">GENERAL</span>
                        )}

                        {notice.category && (
                          <span className="notice-badge">
                            {notice.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <h2>{notice.title}</h2>

                    <p className="notice-history-summary-text">
                      {notice.summary ||
                        "No summary available for this notice."}
                    </p>

                    <div className="notice-history-details">
                      {notice.deadline && (
                        <div>
                          <Calendar size={16} />
                          <span>
                            <strong>Deadline:</strong> {notice.deadline}
                          </span>
                        </div>
                      )}

                      {notice.importance && (
                        <div>
                          <AlertCircle size={16} />
                          <span>
                            <strong>Importance:</strong> {notice.importance}
                          </span>
                        </div>
                      )}

                      {notice.required_action && (
                        <div>
                          <CheckCircle2 size={16} />
                          <span>
                            <strong>Required Action:</strong>{" "}
                            {notice.required_action}
                          </span>
                        </div>
                      )}

                      {notice.created_at && (
                        <div>
                          <Calendar size={16} />
                          <span>
                            <strong>Published:</strong>{" "}
                            {new Date(notice.created_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="notice-history-actions">
                      {notice.registration_link && (
                        <button
                          onClick={() =>
                            window.open(
                              notice.registration_link,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Open Registration
                          <ExternalLink size={15} />
                        </button>
                      )}

                      {(notice.document_url || notice.pdf_url) && (
                        <button
                          onClick={() => {
                            const documentPath =
                              notice.document_url || notice.pdf_url;

                            const documentUrl = documentPath.startsWith("http")
                              ? documentPath
                              : `${API_BASE}${documentPath}`;

                            window.open(
                              documentUrl,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                        >
                          View Document
                          <ExternalLink size={15} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
