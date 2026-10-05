import { getAuth } from "firebase/auth";
import app from "../firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const auth = getAuth(app);
async function getAuthHeaders(includeJson = false) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("You are not authenticated. Please log in again.");
  }

  const token = await currentUser.getIdToken();

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

// const STUDENT_DATABASE = {
//   STU001: { student_id: "STU001", name: "Aarav Sharma", roll_number: "01", attendance: 92, previous_sem_cgpa: 8.4, extracurricular_count: 3 },
//   STU002: { student_id: "STU002", name: "Riya Patil", roll_number: "02", attendance: 61, previous_sem_cgpa: 6.1, extracurricular_count: 1 },
//   STU003: { student_id: "STU003", name: "Aditya Kulkarni", roll_number: "03", attendance: 88, previous_sem_cgpa: 8.0, extracurricular_count: 2 },
//   STU004: { student_id: "STU004", name: "Sneha Joshi", roll_number: "04", attendance: 74, previous_sem_cgpa: 7.1, extracurricular_count: 3 },
//   STU005: { student_id: "STU005", name: "Vedant Shah", roll_number: "05", attendance: 45, previous_sem_cgpa: 5.4, extracurricular_count: 0 },
//   STU006: { student_id: "STU006", name: "Ananya Deshmukh", roll_number: "06", attendance: 96, previous_sem_cgpa: 9.1, extracurricular_count: 4 },
//   STU007: { student_id: "STU007", name: "Rahul Mehta", roll_number: "07", attendance: 68, previous_sem_cgpa: 6.8, extracurricular_count: 2 },
//   STU008: { student_id: "STU008", name: "Isha Gupta", roll_number: "08", attendance: 82, previous_sem_cgpa: 7.6, extracurricular_count: 3 },
//   STU009: { student_id: "STU009", name: "Om More", roll_number: "09", attendance: 18, previous_sem_cgpa: 7.4, extracurricular_count: 2 },
//   STU010: { student_id: "STU010", name: "Kavya Nair", roll_number: "10", attendance: 90, previous_sem_cgpa: 7.9, extracurricular_count: 4 },
// };

/**
 * Fetch student profile details from FastAPI backend: GET /api/students/{student_id}
 */
export async function getStudentProfile(studentId) {
  const cleanId = (studentId || "").trim().toUpperCase();

  if (!cleanId) {
    throw new Error("Student ID is required.");
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}`,
      {
        method: "GET",
        headers: await getAuthHeaders(),
      },
    );

    if (response.ok) {
      return await response.json();
    }

    // IMPORTANT:
    // Do NOT use the local fallback if authentication fails.
    if (response.status === 401 || response.status === 403) {
      const errorText = await response.text();

      throw new Error(
        `Authentication failed (${response.status}): ${errorText}`,
      );
    }

    // Other backend errors
    const errorText = await response.text();

    throw new Error(
      `Failed to fetch student profile (${response.status}): ${errorText}`,
    );
  } catch (err) {
    // Authentication errors must NOT fall back to fake/local data
    if (
      err.message?.includes("Authentication failed") ||
      err.message?.includes("not authenticated")
    ) {
      throw err;
    }

    console.warn("Backend API call failed:", err);
    throw err;
  }
}

/**
 * Check student Interest+ status: GET /api/students/{student_id}/interests/status
 */
export async function getStudentInterestStatus(studentId) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) return { completed: false, interests: [] };

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/interests/status`,
      {
        method: "GET",
        headers: await getAuthHeaders(),
      },
    );

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn("Backend interest status API call failed:", err);
  }

  return { completed: false, interests: [] };
}
/**
 * Fetch available interest options: GET /api/interests/options
 */
export async function getInterestOptions() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/interests/options`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.options || [];
    }
  } catch (err) {
    console.warn("Failed to fetch interest options from API:", err);
  }

  return [
    "Government & Public Services",
    "IT & Technology",
    "Coding & Software",
    "Business & Entrepreneurship",
    "Finance",
    "Creative & Media",
    "Healthcare",
    "Education",
    "Law",
    "Marketing",
  ];
}

/**
 * Save selected student interest: POST /api/students/{student_id}/interests
 */
export async function saveStudentInterest(studentId, interest) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) throw new Error("Student ID is required.");

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/interests`,
    {
      method: "POST",
      headers: await getAuthHeaders(true),
      body: JSON.stringify({ interest }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to save interest: ${errText}`);
  }

  return await response.json();
}

/**
 * Fetch student's notice personalization preferences.
 */
export async function getStudentPreferences(studentId) {
  const cleanId = (studentId || "").trim().toUpperCase();

  if (!cleanId) {
    throw new Error("Student ID is required.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/preferences`,
    {
      method: "GET",
      headers: await getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to fetch preferences (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}

/**
 * Update student's notice personalization preferences.
 */
export async function updateStudentPreferences(studentId, preferences) {
  const cleanId = (studentId || "").trim().toUpperCase();

  if (!cleanId) {
    throw new Error("Student ID is required.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/preferences`,
    {
      method: "PUT",
      headers: await getAuthHeaders(true),
      body: JSON.stringify({
        preferences,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to update preferences (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}
/**
 * Start or resume an Interest+ AI discovery session: POST /api/students/{student_id}/interest-session/start
 */
export async function startInterestSession(studentId, interest, reset = false) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) throw new Error("Student ID is required.");

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/interest-session/start?reset=${reset}`,
    {
      method: "POST",
      headers: await getAuthHeaders(true),
      body: JSON.stringify({ interest }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to start interest session: ${errText}`);
  }

  return await response.json();
}

/**
 * Submit answer to current question and receive next AI question or final analysis:
 * POST /api/students/{student_id}/interest-session/answer
 */
export async function submitInterestAnswer(
  studentId,
  { interest, question_id, question, answer, question_order },
) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) throw new Error("Student ID is required.");

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/interest-session/answer`,
    {
      method: "POST",
      headers: await getAuthHeaders(true),
      body: JSON.stringify({
        interest,
        question_id,
        question,
        answer,
        question_order,
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to submit answer: ${errText}`);
  }

  return await response.json();
}

/**
 * Fetch student's Interest+ AI analysis
 * GET /api/students/{student_id}/interest-analysis
 */
export async function getStudentInterestAnalysis(studentId) {
  const cleanId = (studentId || "").trim().toUpperCase();

  if (!cleanId) {
    throw new Error("Student ID is required.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/interest-analysis`,
    {
      method: "GET",
      headers: await getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to fetch interest analysis (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}

/**
 * Fetch AI-discovered career directions for the student:
 * GET /api/students/{student_id}/career-directions
 */
export async function getStudentCareerDirections(studentId) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) throw new Error("Student ID is required.");

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/career-directions`,
    {
      method: "GET",
      headers: await getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch career directions (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}

/**
 * Fetch Skill Gap Analysis for the student:
 * GET /api/students/{student_id}/skill-gap
 */
export async function getStudentSkillGap(
  studentId,
  direction = null,
  forceRefresh = false,
) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) throw new Error("Student ID is required.");

  const queryParams = new URLSearchParams();
  if (direction) queryParams.append("direction", direction);
  if (forceRefresh) queryParams.append("force_refresh", "true");

  const url = `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/skill-gap${
    queryParams.toString() ? `?${queryParams.toString()}` : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    headers: await getAuthHeaders(),
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch skill gap analysis (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}

/**
 * Fetch personalized AI Roadmap for the student:
 * GET /api/students/{student_id}/roadmap
 */
export async function getStudentRoadmap(
  studentId,
  direction = null,
  forceRefresh = false,
) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) throw new Error("Student ID is required.");

  const queryParams = new URLSearchParams();
  if (direction) queryParams.append("direction", direction);
  if (forceRefresh) queryParams.append("force_refresh", "true");

  const url = `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/roadmap${
    queryParams.toString() ? `?${queryParams.toString()}` : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    headers: await getAuthHeaders(),
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch student roadmap (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}

/**
 * Trigger explicit Career Pivot analysis for a specific direction:
 * POST /api/students/{student_id}/career-pivot/analyze
 */
export async function analyzeCareerDirection(
  studentId,
  direction,
  forceRefresh = true,
) {
  const cleanId = (studentId || "").trim().toUpperCase();
  if (!cleanId) throw new Error("Student ID is required.");

  const response = await fetch(
    `${API_BASE_URL}/api/students/${encodeURIComponent(cleanId)}/career-pivot/analyze`,
    {
      method: "POST",
      headers: await getAuthHeaders(true),
      body: JSON.stringify({
        direction,
        force_refresh: forceRefresh,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to analyze career direction (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}
