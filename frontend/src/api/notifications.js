import { getAuth } from "firebase/auth";
import app from "../firebase";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const auth = getAuth(app);

async function getAuthHeaders() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("You are not authenticated. Please log in again.");
  }

  const token = await currentUser.getIdToken();

  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ============================================================
// GET ALL NOTICES — TEACHER
// ============================================================

export async function getAllNotices() {
  const response = await fetch(`${API_BASE}/api/notices`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch notices: ${error}`);
  }

  return response.json();
}

// ============================================================
// CREATE STUDENT
// ============================================================

export async function createStudent(student) {
  const response = await fetch(`${API_BASE}/api/students`, {
    method: "POST",
    headers: {
      ...(await getAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(student),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to create student");
  }

  return data;
}

// ============================================================
// GET STUDENT NOTIFICATIONS
// ============================================================

export async function getStudentNotifications(studentId) {
  const cleanId = (studentId || "").trim().toUpperCase();

  const response = await fetch(
    `${API_BASE}/api/student/${encodeURIComponent(cleanId)}/notifications`,
    {
      headers: await getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch notifications: ${error}`);
  }

  return response.json();
}

// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

export async function markNotificationRead(studentId, notificationId) {
  const cleanId = (studentId || "").trim().toUpperCase();

  const response = await fetch(
    `${API_BASE}/api/student/${encodeURIComponent(
      cleanId,
    )}/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: await getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to mark notification as read: ${error}`);
  }

  return response.json();
}

// ============================================================
// UPLOAD NOTICE — PDF / IMAGE
// ============================================================

export async function uploadNotice(file) {
  const formData = new FormData();

  formData.append("file", file);

  let endpoint;

  if (file.type === "application/pdf") {
    endpoint = "/api/admin/notice/pdf";
  } else {
    endpoint = "/api/admin/notice/image";
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Upload failed");
  }

  return response.json();
}

// ============================================================
// TEXT NOTICE
// ============================================================

export async function uploadTextNotice(text) {
  const formData = new FormData();

  formData.append("text", text);

  const response = await fetch(`${API_BASE}/api/admin/notice/text`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();

    throw new Error(error.detail || "Text notice processing failed");
  }

  return response.json();
}

// ============================================================
// GET ALL NOTICES — STUDENT
// ============================================================

export async function getAllStudentNotices(studentId) {
  const cleanId = (studentId || "").trim().toUpperCase();

  const response = await fetch(
    `${API_BASE}/api/student/${encodeURIComponent(cleanId)}/notices`,
    {
      headers: await getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch all notices: ${error}`);
  }

  return response.json();
}

// ============================================================
// BATCH NOTICE UPLOAD
// ============================================================

export async function uploadNoticesBatch(files) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE}/api/admin/notices/batch`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Batch notice upload failed");
  }

  return data;
}
