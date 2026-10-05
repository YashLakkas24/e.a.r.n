import { getAuth } from "firebase/auth";
import app from "../firebase";

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

const auth = getAuth(app);


// =========================================================
// AUTH HEADERS
// =========================================================

async function getAuthHeaders() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "You are not authenticated. Please log in again."
    );
  }

  const token = await currentUser.getIdToken();

  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}


// =========================================================
// GET REQUEST
// =========================================================

async function apiGet(path) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method: "GET",
      headers: await getAuthHeaders(),
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Request to ${path} failed with status ${response.status}`;

    try {
      const errorData = await response.json();

      if (errorData?.detail) {
        errorMessage = errorData.detail;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return response.json();
}


// =========================================================
// CSV UPLOAD
// =========================================================

export async function uploadStudentCSV(file) {
  if (!file) {
    throw new Error(
      "Please select a CSV file."
    );
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error(
      "Only CSV files are allowed."
    );
  }

  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  const response = await fetch(
    `${API_BASE_URL}/teacher/upload-csv`,
    {
      method: "POST",

      headers: await getAuthHeaders(),

      // IMPORTANT:
      // Do NOT manually set Content-Type here.
      // Browser automatically adds multipart/form-data
      // boundary for FormData.
      body: formData,
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {

    const message =
      data?.detail ||
      `CSV upload failed with status ${response.status}`;

    throw new Error(message);
  }

  // New CSV means old analytics are invalid.
  analyticsCache = null;

  return data;
}


// =========================================================
// ANALYTICS CACHE
// =========================================================

let analyticsCache = null;


// =========================================================
// GET TEACHER ANALYTICS
// =========================================================

export async function getTeacherAnalytics() {

  if (analyticsCache !== null) {
    return analyticsCache;
  }

  const data = await apiGet(
    "/teacher/analytics"
  );

  analyticsCache = data;

  return data;
}


// =========================================================
// GET TEACHER PROFILE
// =========================================================

export async function getTeacherProfile() {

  const storedUser =
    localStorage.getItem("user");

  if (!storedUser) {
    throw new Error(
      "No logged-in user found."
    );
  }

  let user;

  try {
    user = JSON.parse(
      storedUser
    );
  } catch {
    throw new Error(
      "Invalid stored user information."
    );
  }

  if (user.role !== "teacher") {
    throw new Error(
      "Logged-in user is not a teacher."
    );
  }

  return {
    teacher_name:
      user.full_name ||
      user.name ||
      "Teacher",

    teacher_id:
      user.user_id ||
      user.id ||
      "",

    department:
      user.department ||
      "AI & Data Science",
  };
}


// =========================================================
// RISK SUMMARY
// =========================================================

export async function getRiskSummary() {

  const data =
    await getTeacherAnalytics();

  return {
    high: Number(
      data?.risk_summary?.HIGH ?? 0
    ),

    medium: Number(
      data?.risk_summary?.MEDIUM ?? 0
    ),

    low: Number(
      data?.risk_summary?.LOW ?? 0
    ),
  };
}


// =========================================================
// PERFORMANCE TREND
// =========================================================

export async function getPerformanceTrend() {

  const data =
    await getTeacherAnalytics();

  const allStudents = [
    ...(data?.students?.HIGH || []),
    ...(data?.students?.MEDIUM || []),
    ...(data?.students?.LOW || []),
  ];

  return allStudents.map(
    (student) => ({
      student_id:
        student.student_id,

      student_name:
        student.student_name ||
        student.name ||
        "Unknown Student",

      trend_score:
        student.trend_score ??
        student.risk_score ??
        0,

      trend:
        student.performance_trend ||
        student.trend ||
        "STABLE",
    })
  );
}


// =========================================================
// STUDENTS BY RISK
// =========================================================

export async function getStudentsByRisk(
  riskLevel
) {

  const normalizedRisk =
    String(riskLevel || "")
      .toUpperCase();

  if (
    ![
      "HIGH",
      "MEDIUM",
      "LOW",
    ].includes(normalizedRisk)
  ) {
    throw new Error(
      "Risk must be HIGH, MEDIUM or LOW."
    );
  }

  const data =
    await getTeacherAnalytics();

  const students =
    data?.students?.[
      normalizedRisk
    ] || [];

  return students.map(
    (student) => ({
      student_id:
        student.student_id,

      student_name:
        student.student_name ||
        student.name ||
        "Unknown Student",

      risk_level:
        student.risk_level ||
        normalizedRisk,

      risk_score:
        student.risk_score ??
        0,

      performance_trend:
        student.performance_trend ||
        student.trend ||
        "STABLE",
    })
  );
}


// =========================================================
// STUDENT DETAILS
// =========================================================

export async function getStudentDetails(
  studentId
) {

  if (!studentId) {
    throw new Error(
      "Student ID is required."
    );
  }

  const data =
    await apiGet(
      `/teacher/students/${encodeURIComponent(
        studentId
      )}`
    );

  const rawIntervention =
    data?.intervention;

  const interventionReasons =
    Array.isArray(
      rawIntervention?.reasons
    )
      ? rawIntervention.reasons
      : typeof rawIntervention ===
          "string"
        ? rawIntervention
            .split("\n")
            .map(
              (reason) =>
                reason.trim()
            )
            .filter(Boolean)
        : [];

  const interventionRecommendation =
    typeof rawIntervention?.recommendation ===
    "string"
      ? rawIntervention.recommendation.trim()
      : "";

  const intervention = {
    reasons:
      interventionReasons,

    recommendation:
      interventionRecommendation,
  };

  let aiSuggestion = "";

  if (
    typeof data?.ai_analysis ===
    "string"
  ) {

    aiSuggestion =
      data.ai_analysis.trim();

  } else if (
    data?.ai_analysis &&
    typeof data.ai_analysis ===
      "object"
  ) {

    aiSuggestion =
      data.ai_analysis.recommendation ||
      data.ai_analysis.suggestion ||
      "";
  }

  if (!aiSuggestion) {

    aiSuggestion =
      "AI analysis is currently unavailable.";
  }

  return {
    student_id:
      data.student_id,

    student_name:
      data.student_name ||
      "Unknown Student",

    risk_level:
      data.risk_level ||
      "LOW",

    performance_trend:
      data.performance_trend ||
      "STABLE",

    analysis:
      typeof data.analysis ===
      "string"
        ? data.analysis.trim()
        : "",

    intervention,

    ai_suggestion:
      aiSuggestion,
  };
}


// =========================================================
// CACHE CONTROL
// =========================================================

export function clearTeacherAnalyticsCache() {
  analyticsCache = null;
}


export async function refreshTeacherAnalytics() {

  analyticsCache = null;

  return getTeacherAnalytics();
}