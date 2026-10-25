import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing/Landing";
import Login from "./pages/Login/Login";

import TeacherWelcome from "./pages/teachers-dash/TeacherWelcome";
import TeacherAnalytics from "./pages/teachers-dash/TeacherAnalytics";

import StudentDashboard from "./pages/Student/StudentDashboard";

import InterestPlus from "./pages/Student/InterestPlus";
import InterestQuestions from "./pages/Student/InterestQuestions";
import InterestResult from "./pages/Student/InterestResult";
import SkillGap from "./pages/Student/SkillGap";
import CareerPathExplorer from "./pages/Student/CareerPathExplorer";
import StudentRoadmap from "./pages/Student/StudentRoadmap";

import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import NoticeUpload from "./pages/teachers-dash/NoticeUpload";
import StudentPreferences from "./pages/Student/StudentPreferences";
import NoticeHistory from "./pages/teachers-dash/NoticeHistory";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ==================================================
            PUBLIC ROUTES
        ================================================== */}

        <Route path="/" element={<Landing />} />

        <Route path="/login" element={<Login />} />

        {/* ==================================================
            TEACHER ROUTES
        ================================================== */}

        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherWelcome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/analytics"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherAnalytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/notices"
          element={
            <ProtectedRoute allowedRole="teacher">
              <NoticeUpload />
            </ProtectedRoute>
          }
        />
        {/* ==================================================
            STUDENT ROUTES
        ================================================== */}

        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/interest"
          element={
            <ProtectedRoute allowedRole="student">
              <InterestPlus />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/interest/questions"
          element={
            <ProtectedRoute allowedRole="student">
              <InterestQuestions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/interest/result"
          element={
            <ProtectedRoute allowedRole="student">
              <InterestResult />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/career-paths"
          element={
            <ProtectedRoute allowedRole="student">
              <CareerPathExplorer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/skills"
          element={
            <ProtectedRoute allowedRole="student">
              <SkillGap />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/skill-gap"
          element={
            <ProtectedRoute allowedRole="student">
              <SkillGap />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/roadmap"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentRoadmap />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/preferences"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentPreferences />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/notice-history"
          element={
            <ProtectedRoute allowedRole="teacher">
              <NoticeHistory />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
