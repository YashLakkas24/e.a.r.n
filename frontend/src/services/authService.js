import { getAuth, signInWithCustomToken } from "firebase/auth";
import app from "../firebase";

// Fallback to local server if environment variables are missing, and strip trailing slashes
const RAW_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_BASE_URL = RAW_URL.replace(/\/$/, "");

console.log("API_BASE_URL:", API_BASE_URL);
const auth = getAuth(app);

function withTimeout(promise, milliseconds, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), milliseconds),
    ),
  ]);
}

/**
 * Login user through FastAPI backend.
 *
 * Flow:
 * PostgreSQL credentials
 * → FastAPI
 * → Firebase Custom Token
 * → Firebase login
 * → Firebase ID Token
 * → localStorage
 */
export async function submitLogin(role, id, password) {
  if (!id?.trim() || !password?.trim()) {
    throw new Error("Please enter both an ID and a password.");
  }

  const cleanId = id.trim().toUpperCase();

  // --------------------------------------------------
  // 1. PostgreSQL / FastAPI login
  // --------------------------------------------------
  let response;

  try {
    response = await withTimeout(
      fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          user_id: cleanId,
          password,
          role,
        }),
      }),
      60000,
      "Backend login timed out. Please try again.",
    );
  } catch (error) {
    if (error.message?.includes("timed out")) {
      throw error;
    }

    throw new Error(
      `Cannot connect to backend at ${API_BASE_URL}. Please check if your FastAPI backend is running.`,
    );
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  // --------------------------------------------------
  // 2. Check backend authentication
  // --------------------------------------------------
  if (!response.ok) {
    throw new Error(
      data?.detail || `Server error (${response.status}): Invalid ID or password.`,
    );
  }

  // --------------------------------------------------
  // 3. Validate Firebase custom token
  // --------------------------------------------------
  if (!data?.firebase_token) {
    throw new Error(
      "Login successful, but Firebase authentication token was not received from backend.",
    );
  }

  // --------------------------------------------------
  // 4. Clear any previous Firebase session
  // --------------------------------------------------
  try {
    await auth.signOut();
  } catch (error) {
    console.warn("Previous Firebase session could not be cleared:", error);
  }

  // --------------------------------------------------
  // 5. Firebase Custom Token login
  // --------------------------------------------------
  let firebaseUser;

  try {
    const userCredential = await withTimeout(
      signInWithCustomToken(auth, data.firebase_token),
      15000,
      "Firebase login timed out. Please check your Firebase configuration and internet connection.",
    );

    firebaseUser = userCredential.user;
  } catch (error) {
    console.error("Firebase authentication error:", error);

    throw new Error(
      error.message ||
        "PostgreSQL login succeeded, but Firebase authentication failed.",
    );
  }

  // --------------------------------------------------
  // 6. Get Firebase ID token
  // --------------------------------------------------
  let firebaseIdToken;

  try {
    firebaseIdToken = await withTimeout(
      firebaseUser.getIdToken(true),
      15000,
      "Firebase ID token request timed out.",
    );
  } catch (error) {
    console.error("Firebase ID token error:", error);

    throw new Error(
      error.message ||
        "Firebase login succeeded, but the Firebase ID token could not be obtained.",
    );
  }

  // --------------------------------------------------
  // 7. Save the EXACT backend user information
  // --------------------------------------------------
  const user = {
    user_id: data.user_id,
    student_id: data.user_id,
    full_name: data.full_name,
    role: data.role,
  };

  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("firebase_id_token", firebaseIdToken);

  console.log("LOGIN SUCCESS:", {
    user_id: data.user_id,
    role: data.role,
    firebase_uid: firebaseUser.uid,
  });

  // --------------------------------------------------
  // 8. Return login result
  // --------------------------------------------------
  return {
    ...data,
    firebaseIdToken,
    firebaseUser,
    redirectTo:
      data.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
  };
}

/**
 * Get the currently signed-in Firebase user's ID token.
 */
export async function getFirebaseToken() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  return await currentUser.getIdToken();
}

/**
 * Logout from Firebase and clear local application data.
 */
export async function logout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Firebase logout error:", error);
  }

  localStorage.removeItem("user");
  localStorage.removeItem("firebase_id_token");
}

/**
 * Get currently logged-in application user.
 */
export function getLoggedInUser() {
  try {
    const user = localStorage.getItem("user");

    if (!user) {
      return null;
    }

    return JSON.parse(user);
  } catch (error) {
    console.error("Failed to read stored user:", error);
    return null;
  }
}

/**
 * Check whether Firebase currently has an authenticated user.
 */
export function isLoggedIn() {
  return auth.currentUser !== null;
}