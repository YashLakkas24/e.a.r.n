
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Compass,
  AlertTriangle,
  RotateCcw,
  Target,
  BookOpen,
  BriefcaseBusiness,
  FileText,
  MessageSquare,
  Search,
} from "lucide-react";
import {
  getStudentRoadmap,
  getStudentCareerDirections,
} from "../../services/studentService";
import "./StudentRoadmap.css";

const FALLBACK_TASKS = [
  {
    id: "explore-careers",
    title: "Explore legal career options",
    description:
      "Identify legal roles and internship opportunities that interest you.",
    detail:
      "Explore legal career paths and identify internship opportunities that match your interests.",
    skills: ["Career exploration", "Decision-making"],
    difficulty: "Beginner",
    icon: Compass,
  },
  {
    id: "prepare-application",
    title: "Prepare your internship application",
    description:
      "Create application materials that highlight your experience and strengths.",
    detail:
      "Prepare a resume and cover letter that communicate your experience, strengths, and interest in a legal internship.",
    skills: ["Written communication", "Self-presentation"],
    difficulty: "Beginner",
    icon: FileText,
  },
  {
    id: "prepare-interview",
    title: "Prepare for an internship interview",
    description:
      "Practice introducing yourself and explaining your relevant experience.",
    detail:
      "Build confidence in explaining your interests, experience, and motivation for applying to a legal internship.",
    skills: ["Communication", "Interview skills"],
    difficulty: "Beginner",
    icon: MessageSquare,
  },
  {
    id: "find-opportunities",
    title: "Find and evaluate internship opportunities",
    description:
      "Compare opportunities against your interests and current experience.",
    detail:
      "Identify suitable internship opportunities and compare their requirements with your interests and experience.",
    skills: ["Research", "Planning"],
    difficulty: "Beginner",
    icon: Search,
  },
];

const TASK_ICONS = {
  compass: Compass,
  explore: Compass,
  career: Compass,
  filetext: FileText,
  document: FileText,
  application: FileText,
  message: MessageSquare,
  interview: MessageSquare,
  search: Search,
  opportunity: Search,
  target: Target,
  book: BookOpen,
};

function getFirstValue(object, keys, fallback = undefined) {
  for (const key of keys) {
    const value = object?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function toText(value, fallback = "") {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return [];

  return skills
    .map((skill) => {
      if (typeof skill === "string") return skill;

      return toText(
        getFirstValue(skill, ["name", "title", "skill", "label"])
      );
    })
    .filter(Boolean);
}

function normalizeAction(action, index) {
  if (typeof action === "string") {
    return {
      id: `action-${index + 1}`,
      title: action,
      subtitle: "",
      body: "",
    };
  }

  if (!action || typeof action !== "object") return null;

  const title = toText(
    getFirstValue(action, ["title", "name", "action", "task", "label"]),
    `Action ${index + 1}`
  );

  return {
    id: toText(
      getFirstValue(action, ["id", "action_id"]),
      `action-${index + 1}`
    ),
    title,
    subtitle: toText(
      getFirstValue(action, ["subtitle", "summary", "short_description"])
    ),
    body: toText(
      getFirstValue(action, [
        "body",
        "description",
        "instructions",
        "details",
        "content",
      ])
    ),
  };
}

function getRawActions(task) {
  const actions = getFirstValue(task, [
    "actions",
    "activities",
    "sub_tasks",
    "subtasks",
    "action_items",
    "steps",
  ]);

  return Array.isArray(actions) ? actions : [];
}

function normalizeTask(task, index) {
  if (!task || typeof task !== "object") return null;

  const fallback = FALLBACK_TASKS[index] || {};
  const title = toText(
    getFirstValue(task, ["title", "name", "task", "task_name"]),
    fallback.title || `Roadmap task ${index + 1}`
  );

  const iconKey = title.toLowerCase().replace(/[^a-z]/g, "");
  const matchingIconKey = Object.keys(TASK_ICONS).find((key) =>
    iconKey.includes(key)
  );

  return {
    id: toText(
      getFirstValue(task, ["id", "task_id", "step_id"]),
      `roadmap-task-${index + 1}`
    ),
    title,
    description: toText(
      getFirstValue(task, [
        "description",
        "summary",
        "short_description",
      ]),
      fallback.description || ""
    ),
    detail: toText(
      getFirstValue(task, [
        "detail",
        "details",
        "instructions",
        "description",
        "summary",
      ]),
      fallback.detail || fallback.description || ""
    ),
    skills: normalizeSkills(
      getFirstValue(task, ["skills", "required_skills", "skill_gaps"], [])
    ),
    difficulty: toText(
      getFirstValue(task, ["difficulty", "level", "priority"]),
      fallback.difficulty || "Recommended"
    ),
    icon: fallback.icon || TASK_ICONS[matchingIconKey] || Compass,
    actions: getRawActions(task)
      .map(normalizeAction)
      .filter(Boolean),
  };
}

function getRoadmapTasks(response) {
  const possibleTaskLists = [
    response?.tasks,
    response?.roadmap_tasks,
    response?.roadmap_steps,
    response?.steps,
    response?.roadmap?.tasks,
    response?.roadmap?.steps,
    response?.data?.tasks,
    response?.data?.roadmap_steps,
    response?.data?.steps,
  ];

  const apiTasks = possibleTaskLists.find(Array.isArray);

  if (apiTasks?.length) {
    return apiTasks.map(normalizeTask).filter(Boolean);
  }

  // Keep the page usable if the endpoint does not provide a task list.
  // Fallback tasks intentionally do not contain fixed action arrays.
  return FALLBACK_TASKS.map((task, index) =>
    normalizeTask(task, index)
  );
}

function StudentRoadmap() {
  const navigate = useNavigate();
  const location = useLocation();

  const [roadmapData, setRoadmapData] = useState(null);
  const [roadmapTasks, setRoadmapTasks] = useState([]);
  const [selectedDirection, setSelectedDirection] = useState(
    location.state?.direction || null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);

  const getStudentId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.student_id || user.user_id || "STU001";
    } catch {
      return "STU001";
    }
  };

  const studentId = getStudentId();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        let availableDirections = [];

        try {
          const directionResponse =
            await getStudentCareerDirections(studentId);

          if (
            directionResponse?.has_analysis &&
            Array.isArray(directionResponse.directions)
          ) {
            availableDirections = directionResponse.directions;
          }
        } catch (directionError) {
          console.warn(
            "Could not load career directions:",
            directionError
          );
        }

        const targetDirection =
          selectedDirection ||
          availableDirections[0]?.name ||
          "Explore legal internships";

        const response = await getStudentRoadmap(
          studentId,
          targetDirection
        );

        if (!isMounted) return;

        if (response?.has_analysis === false) {
          setError(
            response.detail ||
              "Your interest profile is not ready yet. Please complete the Interest+ discovery quiz first."
          );
          setRoadmapData(null);
          setRoadmapTasks([]);
          return;
        }

        setRoadmapData(response);
        setRoadmapTasks(getRoadmapTasks(response));

        if (response?.direction) {
          setSelectedDirection(response.direction);
        } else {
          setSelectedDirection(targetDirection);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.message ||
              "Failed to load your roadmap. Please check your backend connection."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError("");

      const direction =
        selectedDirection ||
        roadmapData?.direction ||
        "Explore legal internships";

      const response = await getStudentRoadmap(
        studentId,
        direction,
        true
      );

      if (response?.has_analysis === false) {
        setError(response.detail || "Your roadmap is not available yet.");
        return;
      }

      setRoadmapData(response);
      setRoadmapTasks(getRoadmapTasks(response));

      if (response?.direction) {
        setSelectedDirection(response.direction);
      }
      setSelectedTask(null);
    } catch (err) {
      setError(err.message || "Failed to refresh your roadmap.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleBackToRoadmap = () => setSelectedTask(null);

  if (loading) {
    return (
      <div className="roadmap-page">
        <header className="roadmap-header">
          <button
            className="roadmap-back"
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <div className="roadmap-brand">
            <Sparkles size={19} />
            <span>E.A.R.N. Roadmap</span>
          </div>
        </header>

        <main className="roadmap-main">
          <section className="roadmap-state-card">
            <div className="roadmap-spinner" />
            <h2>Loading your roadmap...</h2>
            <p>Preparing your recommended career activities.</p>
          </section>
        </main>
      </div>
    );
  }

  if (error && !roadmapData) {
    return (
      <div className="roadmap-page">
        <header className="roadmap-header">
          <button
            className="roadmap-back"
            onClick={() => navigate("/student/dashboard")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <div className="roadmap-brand">
            <Sparkles size={19} />
            <span>E.A.R.N. Roadmap</span>
          </div>
        </header>

        <main className="roadmap-main">
          <section className="roadmap-state-card roadmap-error-card">
            <AlertTriangle size={32} />
            <h2>Roadmap unavailable</h2>
            <p>{error}</p>

            <div className="roadmap-state-actions">
              <button
                className="roadmap-primary-btn"
                onClick={() => navigate("/student/interest")}
              >
                Start Interest+ Quiz
              </button>

              <button
                className="roadmap-secondary-btn"
                onClick={() => navigate("/student/dashboard")}
              >
                Back to Dashboard
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (selectedTask) {
    const TaskIcon = selectedTask.icon || Compass;
    const actions = Array.isArray(selectedTask.actions)
      ? selectedTask.actions
      : [];

    return (
      <div className="roadmap-page">
        <header className="roadmap-header">
          <button className="roadmap-back" onClick={handleBackToRoadmap}>
            <ArrowLeft size={17} />
            Back to roadmap
          </button>

          <div className="roadmap-brand">
            <Sparkles size={19} />
            <span>E.A.R.N. Roadmap</span>
          </div>
        </header>

        <main className="roadmap-main task-detail-main">
          <button
            className="task-back-link"
            onClick={handleBackToRoadmap}
          >
            <ArrowLeft size={16} />
            All roadmap tasks
          </button>

          <section className="task-detail-card">
            <div className="task-detail-topline">
              <span className="roadmap-eyebrow">ROADMAP TASK</span>
              <span className="task-difficulty">
                {selectedTask.difficulty}
              </span>
            </div>

            <div className="task-detail-heading">
              <div className="task-detail-icon">
                <TaskIcon size={24} />
              </div>

              <div>
                <h1>{selectedTask.title}</h1>
                <p>{selectedTask.detail || selectedTask.description}</p>
              </div>
            </div>

            <div className="task-action-heading">
              <span className="task-action-count">
                {actions.length} {actions.length === 1 ? "action" : "actions"}
              </span>

              <h2>
                {actions.length > 0
                  ? "Your practical next steps"
                  : "No actions available yet"}
              </h2>

              <p>
                {actions.length > 0
                  ? "Work through the recommended steps for this task."
                  : "The roadmap has not provided actions for this task yet. Refresh the roadmap or check whether your backend returns an actions list."}
              </p>
            </div>

            {actions.length > 0 ? (
              <div className="task-actions-list">
                {actions.map((action, index) => (
                  <article
                    className="task-action-card"
                    key={`${selectedTask.id}-${action.id || index}`}
                  >
                    <div className="task-action-number">{index + 1}</div>

                    <div className="task-action-content">
                      <h3>{action.title}</h3>

                      {action.subtitle && (
                        <p className="task-action-subtitle">
                          {action.subtitle}
                        </p>
                      )}

                      {action.body && (
                        <p className="task-action-description">
                          {action.body}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="task-actions-empty">
                Actions will appear here when they are included in the
                roadmap response.
              </div>
            )}

            <button
              className="roadmap-secondary-btn task-detail-back-btn"
              onClick={handleBackToRoadmap}
            >
              <ArrowLeft size={16} />
              Return to roadmap
            </button>
          </section>
        </main>
      </div>
    );
  }

  const displayedDirection =
    roadmapData?.direction ||
    selectedDirection ||
    "Explore legal internships";

  return (
    <div className="roadmap-page">
      <header className="roadmap-header">
        <button
          className="roadmap-back"
          onClick={() => navigate("/student/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="roadmap-brand">
          <Sparkles size={19} />
          <span>E.A.R.N. Roadmap</span>
        </div>

        <button
          className="roadmap-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh roadmap data"
        >
          <RotateCcw
            size={14}
            className={refreshing ? "roadmap-spin-icon" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <main className="roadmap-main">
        <section className="roadmap-intro">
          <span className="roadmap-eyebrow">YOUR NEXT STEPS</span>
          <h1>Your Career Roadmap</h1>
          <p>Your recommended path toward your career goal.</p>
        </section>

        <section className="career-direction-card">
          <div className="career-direction-icon">
            <BriefcaseBusiness size={23} />
          </div>

          <div className="career-direction-content">
            <span className="career-direction-label">
              CAREER DIRECTION
            </span>
            <h2>{displayedDirection}</h2>
            <p>
              Follow the recommended tasks to build relevant experience and
              prepare for your next opportunity.
            </p>
          </div>
        </section>

        {error && roadmapData && (
          <div className="roadmap-inline-error" role="status">
            {error}
          </div>
        )}

        <section className="timeline-section">
          <div className="timeline-header">
            <div className="timeline-icon">
              <Target size={20} />
            </div>

            <div>
              <h2>Your path forward</h2>
              <span>
                Open a task to review its available practical actions.
              </span>
            </div>
          </div>

          {roadmapTasks.length > 0 ? (
            <div className="timeline-steps">
              {roadmapTasks.map((task, index) => {
                const TaskIcon = task.icon || Compass;
                const actionCount = task.actions?.length || 0;

                return (
                  <article className="timeline-item" key={task.id}>
                    <div className="timeline-marker" aria-hidden="true">
                      <div className="marker-number">{index + 1}</div>

                      {index < roadmapTasks.length - 1 && (
                        <div className="marker-line" />
                      )}
                    </div>

                    <div className="timeline-card">
                      <div className="timeline-card-heading">
                        <div className="timeline-card-icon">
                          <TaskIcon size={20} />
                        </div>

                        <div className="timeline-card-header">
                          <span className="step-tag">
                            TASK {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3>{task.title}</h3>
                        </div>
                      </div>

                      <p className="step-description">
                        {task.description || task.detail}
                      </p>

                      {task.skills.length > 0 && (
                        <div className="step-skills-wrap">
                          <div className="skills-tags">
                            {task.skills.map((skill) => (
                              <span className="skill-tag" key={skill}>
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="timeline-card-footer">
                        <span className="task-action-preview">
                          <BookOpen size={15} />
                          {actionCount}{" "}
                          {actionCount === 1
                            ? "practical action"
                            : "practical actions"}
                        </span>

                        <button
                          className="view-task-btn"
                          onClick={() => setSelectedTask(task)}
                        >
                          View task
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="roadmap-empty-state">
              <h3>No roadmap tasks available</h3>
              <p>
                Refresh your roadmap or check that the backend returned a
                list of tasks.
              </p>
              <button
                className="roadmap-secondary-btn"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RotateCcw size={15} />
                Try again
              </button>
            </div>
          )}
        </section>

        <div className="roadmap-bottom-nav">
          <button
            className="roadmap-secondary-btn"
            onClick={() =>
              navigate("/student/skills", {
                state: {
                  direction: displayedDirection,
                },
              })
            }
          >
            <Target size={16} />
            Review skill gaps
          </button>
        </div>
      </main>
    </div>
  );
}

export default StudentRoadmap;