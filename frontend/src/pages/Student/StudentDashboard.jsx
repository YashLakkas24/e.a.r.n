import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getStudentProfile,
  getStudentInterestAnalysis,
} from "../../services/studentService";
import {
  getStudentNotifications,
  getAllStudentNotices,
  markNotificationRead,
} from "../../api/notifications";

import {
  LayoutDashboard,
  Sparkles,
  Puzzle,
  Compass,
  Map,
  LogOut,
  GraduationCap,
  CalendarCheck,
  Award,
  ChevronRight,
  CheckCircle2,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";

import "./StudentDashboard.css";

function StudentDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("dashboard");
  const [studentData, setStudentData] = useState(null);
  const [interestAnalysis, setInterestAnalysis] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [allNotices, setAllNotices] = useState([]);
  const [noticeTab, setNoticeTab] = useState("relevant");

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const studentId = savedUser.student_id || savedUser.user_id || "STU001";

  useEffect(() => {
    let isMounted = true;

    getStudentProfile(studentId)
      .then((data) => {
        if (isMounted) {
          setStudentData(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStudentData(null);
        }
      });

    getStudentInterestAnalysis(studentId)
      .then((data) => {
        if (isMounted && data.has_analysis && data.analyses?.length) {
          setInterestAnalysis(data.analyses[0]);
        }
      })
      .catch(() => {
        if (isMounted) {
          setInterestAnalysis(null);
        }
      });
    getStudentNotifications(studentId)
      .then((data) => {
        if (isMounted) {
          setNotifications(data.notifications || []);
        }
      })
      .catch((error) => {
        console.error("Failed to load notifications:", error);
        if (isMounted) {
          setNotifications([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setNotificationsLoading(false);
        }
      });

    getAllStudentNotices(studentId)
      .then((data) => {
        if (isMounted) {
          setAllNotices(data.notices || []);
        }
      })
      .catch((error) => {
        console.error("Failed to load all notices:", error);

        if (isMounted) {
          setAllNotices([]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const student = {
    name: studentData?.name || savedUser.full_name || "Aarav Sharma",
    studentId: studentData?.student_id || studentId,
    rollNumber: studentData?.roll_number || "01",
    branch: studentData?.branch || "AIDS",
    year: studentData?.year
      ? `${studentData.year}${studentData.year === 1 ? "st" : studentData.year === 2 ? "nd" : studentData.year === 3 ? "rd" : "th"} Year`
      : "3rd Year",
    attendance: studentData?.attendance ?? 92,
    previousCgpa: studentData?.previous_sem_cgpa ?? 8.4,
    extracurricular: studentData?.extracurricular_count ?? 3,
  };

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "interest",
      label: "Interest+",
      icon: Sparkles,
      highlight: true,
    },
    {
      id: "preferences",
      label: "Preferences",
      icon: SlidersHorizontal,
    },
    {
      id: "skills",
      label: "Career Paths",
      icon: Map,
    },
  ];

  return (
    <div className="student-dashboard">
      {/* Sidebar */}
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
                className={`student-nav-item ${
                  activePage === item.id ? "active" : ""
                } ${item.highlight ? "interest-nav" : ""}`}
                onClick={() => {
                  if (item.id === "interest") {
                    navigate("/student/interest");
                    return;
                  }

                  if (item.id === "preferences") {
                    navigate("/student/preferences");
                    return;
                  }

                  if (item.id === "skills") {
                    navigate("/student/career-paths");
                    return;
                  }

                  setActivePage(item.id);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.highlight && <span className="interest-badge">AI</span>}
              </button>
            );
          })}
        </nav>

        <div className="student-sidebar-bottom">
          <button
            className="student-nav-item logout-item"
            onClick={() => {
              localStorage.removeItem("user");
              navigate("/");
            }}
          >
            <LogOut size={19} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="student-main">
        {/* Header */}
        <header className="student-header">
          <div>
            <span className="student-eyebrow">STUDENT WORKSPACE</span>

            <h1>Welcome back, {student.name.split(" ")[0]} 👋</h1>

            <p>Here's an overview of your academic journey.</p>
          </div>

          <div className="student-profile-mini">
            <div className="student-avatar">{student.name.charAt(0)}</div>

            <div>
              <strong>{student.name}</strong>
              <span>{student.studentId}</span>
            </div>
          </div>
        </header>

        {/* Student Identity */}
        <section className="student-identity-card">
          <div className="identity-icon">
            <GraduationCap size={25} />
          </div>

          <div className="identity-info">
            <h2>{student.name}</h2>

            <p>
              {student.studentId} · Roll {student.rollNumber} · {student.branch}{" "}
              · {student.year}
            </p>
          </div>
        </section>

        {/* Academic Snapshot */}
        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span className="section-label">OVERVIEW</span>
              <h2>Academic Snapshot</h2>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <CalendarCheck size={21} />
              </div>

              <div>
                <span>Attendance</span>
                <strong>{student.attendance}%</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <GraduationCap size={21} />
              </div>

              <div>
                <span>Previous Sem CGPA</span>
                <strong>{student.previousCgpa}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Award size={21} />
              </div>

              <div>
                <span>Extracurricular</span>
                <strong>{student.extracurricular}</strong>
              </div>
            </div>
          </div>
        </section>
        {/* =====================================================
    STUDENT NOTICES
===================================================== */}

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span className="section-label">NOTICE CENTER</span>
              <h2>
                {noticeTab === "relevant" ? "Relevant Notices" : "All Notices"}
              </h2>
            </div>

            <span>
              {noticeTab === "relevant"
                ? `${
                    notifications.filter(
                      (notification) => notification.status === "UNREAD",
                    ).length
                  } unread`
                : `${allNotices.length} notices`}
            </span>
          </div>

          {/* Notice Tabs */}
          <div className="notice-tabs">
            <button
              className={`notice-tab ${
                noticeTab === "relevant" ? "active" : ""
              }`}
              onClick={() => setNoticeTab("relevant")}
            >
              Relevant Notices
            </button>

            <button
              className={`notice-tab ${noticeTab === "all" ? "active" : ""}`}
              onClick={() => setNoticeTab("all")}
            >
              All Notices
            </button>
          </div>

          {notificationsLoading ? (
            <div className="feature-card">
              <p>Loading notices...</p>
            </div>
          ) : noticeTab === "relevant" ? (
            /* =====================================================
       RELEVANT NOTICES
    ===================================================== */

            notifications.length === 0 ? (
              <div className="feature-card">
                <div className="feature-card-top">
                  <div className="feature-icon">
                    <CheckCircle2 size={21} />
                  </div>
                </div>

                <h3>No relevant notices</h3>

                <p>
                  There are currently no college notices matching your
                  preferences.
                </p>
              </div>
            ) : (
              <div className="dashboard-grid">
                {notifications.map((notification) => (
                  <div
                    className="feature-card"
                    key={notification.notification_id}
                  >
                    <div className="feature-card-top">
                      <div className="feature-icon">
                        <CheckCircle2 size={21} />
                      </div>

                      <span className="coming-soon">
                        {notification.priority}
                      </span>
                    </div>

                    <h3>{notification.title}</h3>

                    <p>
                      {notification.summary ||
                        "No summary available for this notice."}
                    </p>

                    {notification.deadline && (
                      <p>
                        <strong>Deadline:</strong> {notification.deadline}
                      </p>
                    )}

                    {notification.reason && (
                      <p>
                        <strong>Why you're seeing this:</strong>{" "}
                        {notification.reason}
                      </p>
                    )}

                    <div className="notice-actions">
                      {notification.status === "UNREAD" && (
                        <button
                          onClick={async () => {
                            try {
                              await markNotificationRead(
                                studentId,
                                notification.notification_id,
                              );

                              setNotifications((current) =>
                                current.map((item) =>
                                  item.notification_id ===
                                  notification.notification_id
                                    ? {
                                        ...item,
                                        status: "READ",
                                      }
                                    : item,
                                ),
                              );
                            } catch (error) {
                              console.error(
                                "Failed to mark notification as read:",
                                error,
                              );
                            }
                          }}
                        >
                          Mark as Read
                        </button>
                      )}

                      {notification.document_url && (
                        <button
                          onClick={() =>
                            window.open(
                              notification.document_url,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          View Document
                          <ExternalLink size={16} />
                        </button>
                      )}

                      {notification.registration_link && (
                        <button
                          onClick={() =>
                            window.open(
                              notification.registration_link,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Open Registration
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : /* =====================================================
       ALL NOTICES
    ===================================================== */

          allNotices.length === 0 ? (
            <div className="feature-card">
              <div className="feature-card-top">
                <div className="feature-icon">
                  <CheckCircle2 size={21} />
                </div>
              </div>

              <h3>No notices available</h3>

              <p>There are currently no notices published by the college.</p>
            </div>
          ) : (
            <div className="dashboard-grid">
              {allNotices.map((notice) => (
                <div className="feature-card" key={notice.notice_id}>
                  <div className="feature-card-top">
                    <div className="feature-icon">
                      <CheckCircle2 size={21} />
                    </div>

                    {notice.is_mandatory && (
                      <span className="coming-soon">MANDATORY</span>
                    )}
                  </div>

                  <h3>{notice.title}</h3>

                  <p>
                    {notice.summary || "No summary available for this notice."}
                  </p>

                  {notice.category && (
                    <p>
                      <strong>Category:</strong> {notice.category}
                    </p>
                  )}

                  {notice.deadline && (
                    <p>
                      <strong>Deadline:</strong> {notice.deadline}
                    </p>
                  )}

                  <div className="notice-actions">
                    {notice.document_url && (
                      <button
                        onClick={() =>
                          window.open(
                            notice.document_url,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        View Document
                        <ExternalLink size={16} />
                      </button>
                    )}

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
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Interest+ */}
        <section className="interest-card">
          <div className="interest-card-content">
            <div className="interest-icon">
              <Sparkles size={25} />
            </div>

            <div>
              <span className="section-label">
                {interestAnalysis ? "AI PROFILE READY" : "AI-POWERED DISCOVERY"}
              </span>

              <h2>
                {interestAnalysis
                  ? `Interest Profile: ${interestAnalysis.interest}`
                  : "Interest+"}
              </h2>

              <p>
                {interestAnalysis?.summary ||
                  "Discover what genuinely interests you through adaptive questions. Your responses help us understand your interests, experience and areas worth exploring."}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "12px",
                }}
              >
                {interestAnalysis ? (
                  <>
                    <button
                      className="primary-action"
                      onClick={() => navigate("/student/interest/result")}
                    >
                      View Full Analysis
                      <ChevronRight size={17} />
                    </button>

                    <button
                      className="primary-action"
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                      }}
                      onClick={() => navigate("/student/interest")}
                    >
                      Explore New Interest
                      <ChevronRight size={17} />
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-action"
                    onClick={() => navigate("/student/interest")}
                  >
                    Start Interest Discovery
                    <ChevronRight size={17} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="interest-card-decoration">
            <Sparkles size={100} strokeWidth={0.7} />
          </div>
        </section>

        {/* Lower cards */}
        <section className="dashboard-grid">
          {/* Skill Gaps */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon">
                <Puzzle size={21} />
              </div>

              <span
                className="coming-soon"
                style={{
                  background: "rgba(59, 130, 246, 0.2)",
                  color: "#93c5fd",
                }}
              >
                AI INSIGHTS
              </span>
            </div>

            <h3>Skill Gaps</h3>

            <p>
              Understand the skills you need to strengthen based on your
              interests and current capabilities.
            </p>

            <button onClick={() => navigate("/student/skills")}>
              Explore
              <ChevronRight size={16} />
            </button>
          </div>

          {/* AI Roadmap */}
          <div className="feature-card">
            <div className="feature-card-top">
              <div className="feature-icon">
                <Compass size={21} />
              </div>

              <span
                className="coming-soon"
                style={{
                  background: "rgba(168, 85, 247, 0.2)",
                  color: "#d8b4fe",
                }}
              >
                PERSONALIZED
              </span>
            </div>

            <h3>AI Roadmap</h3>

            <p>
              Step-by-step personalized learning milestones generated by AI to
              bridge your identified skill gaps.
            </p>

            <button onClick={() => navigate("/student/roadmap")}>
              View Roadmap
              <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {/* Temporary notice */}
        {activePage !== "dashboard" && (
          <div className="dashboard-notice">
            <strong>
              {menuItems.find((item) => item.id === activePage)?.label}
            </strong>

            <span>
              This section will be connected to its full functionality in the
              next step.
            </span>

            <button onClick={() => setActivePage("dashboard")}>
              Back to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default StudentDashboard;
