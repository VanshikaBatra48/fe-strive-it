import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";

// Initial Mentee's Assignments
const initialMenteeTasks = [
  {
    id: 101,
    title: "Build Responsive TMS Dashboard UI",
    track: "React & Tailwind CSS",
    priority: "High",
    dueDate: "2026-10-28",
    status: "Submitted", // "In Progress", "Submitted", "Completed"
    submissionUrl: "https://github.com/anjali-rao/tms-dashboard-ui",
    demoUrl: "https://tms-anjali.vercel.app",
    score: null,
    mentorFeedback: "Under active review by Amit Sharma. Evaluation will be posted shortly.",
    description:
      "Implement responsive layout with Tailwind CSS matching design specifications. Ensure sidebar is fixed and tables are scrollable.",
  },
  {
    id: 105,
    title: "Custom Formik Hook & Yup Validation",
    track: "React Forms",
    priority: "Medium",
    dueDate: "2026-11-02",
    status: "In Progress",
    submissionUrl: "",
    demoUrl: "",
    score: null,
    mentorFeedback: "",
    description:
      "Create reusable Formik wrapper components for email, password, and select inputs with real-time feedback.",
  },
  {
    id: 106,
    title: "State Management with Context API & Reducers",
    track: "React Architecture",
    priority: "High",
    dueDate: "2026-10-20",
    status: "Completed",
    submissionUrl: "https://github.com/anjali-rao/context-api-demo",
    demoUrl: "https://anjali-state.vercel.app",
    score: 96,
    mentorFeedback:
      "Excellent modular structure! Your action creators and reducer separation are clean and scalable.",
    description:
      "Refactor global authentication state and user preference toggles using React createContext and useReducer.",
  },
  {
    id: 107,
    title: "Git Workflow & Branching Strategy Exercise",
    track: "DevOps & Collaboration",
    priority: "Low",
    dueDate: "2026-10-14",
    status: "Completed",
    submissionUrl: "https://github.com/anjali-rao/git-practice-repo",
    demoUrl: "",
    score: 92,
    mentorFeedback: "Well-crafted commit messages and clean rebase history. Great branch naming conventions.",
    description:
      "Demonstrate feature branching, PR review workflows, and merge conflict resolution.",
  },
];

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const MenteeDashboard = () => {
  const navigate = useNavigate();
  const mainRef = useRef(null);

  // Current logged in mentee details
  const [menteeUser] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user"));
      if (stored && typeof stored === "object") {
        return {
          name: stored.name || "Anjali Rao",
          email: stored.email || "anjali@example.com",
          role: "mentee",
          track: "Frontend (React & UI Engineering)",
          mentor: "Amit Sharma",
          mentorEmail: "amit@example.com",
        };
      }
    } catch {
      // fallback
    }
    return {
      name: "Anjali Rao",
      email: "anjali@example.com",
      role: "mentee",
      track: "Frontend (React & UI Engineering)",
      mentor: "Amit Sharma",
      mentorEmail: "amit@example.com",
    };
  });

  // State: "dashboard", "assignments", "feedback" (Badges removed, Feedback kept)
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tasks, setTasks] = useState(initialMenteeTasks);
  const [taskFilter, setTaskFilter] = useState("All");

  // Dropdown & Modals
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(null);
  const [viewingFeedbackTask, setViewingFeedbackTask] = useState(null);

  // Submission Form State
  const [submissionForm, setSubmissionForm] = useState({
    repoUrl: "",
    demoUrl: "",
    notes: "",
  });

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter === "All") return true;
      return t.status.toLowerCase() === taskFilter.toLowerCase();
    });
  }, [tasks, taskFilter]);

  // Tasks with mentor feedback or evaluations
  const feedbackTasks = useMemo(() => {
    return tasks.filter((t) => t.mentorFeedback || t.status === "Completed" || t.status === "Submitted");
  }, [tasks]);

  // Overall Progress
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "Completed").length,
    [tasks]
  );
  const progressPercentage = Math.round((completedCount / tasks.length) * 100);

  // Switch role handler for pair testing
  const switchRole = (newRole) => {
    const userObj = {
      role: newRole,
      email: `${newRole}@example.com`,
      name: newRole === "admin" ? "Administrator" : newRole === "mentor" ? "Amit Sharma" : "Anjali Rao",
    };
    localStorage.setItem("user", JSON.stringify(userObj));
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  // Submit task handler
  const handleSubmitTask = (e) => {
    e.preventDefault();
    if (!submittingTask) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === submittingTask.id
          ? {
            ...t,
            status: "Submitted",
            submissionUrl: submissionForm.repoUrl,
            demoUrl: submissionForm.demoUrl,
            mentorFeedback: "Submitted! Awaiting review from Amit Sharma.",
          }
          : t
      )
    );

    setSubmittingTask(null);
    setSubmissionForm({ repoUrl: "", demoUrl: "", notes: "" });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sidebar - Viewport pinned */}
      <aside className="w-64 h-screen bg-[#111827] flex-shrink-0 flex flex-col justify-between border-r border-slate-800 z-30 select-none">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className="p-6 pb-6 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 flex items-center justify-center text-white">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2zm0 8.7L3.75 7 12 3.3 20.25 7 12 10.7zM4 10.5v6.2L12 21l8-4.3v-6.2l-8 4.3-8-4.3z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-wide">
                TMS Mentee
              </span>
              <span className="block text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">
                Intern Portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 overflow-y-auto flex-1">
            <button
              onClick={() => {
                setActiveTab("dashboard");
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "dashboard"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("assignments");
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "assignments"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <div className="flex items-center gap-3.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Assignments</span>
              </div>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("feedback");
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "feedback"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Mentor Feedback</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer - Always Visible */}
        <div className="p-4 border-t border-slate-800 bg-[#111827] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {getInitials(menteeUser.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{menteeUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{menteeUser.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 h-screen overflow-y-auto px-8 py-6">
        {/* Top Navbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Workspace</span>
            <span className="text-xs text-slate-300 dark:text-slate-600">/</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Intern Portal</span>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Dark Mode Toggle Button */}
            <ThemeToggle />

            {/* Quick Submit Button */}
            <button
              onClick={() => {
                const pendingTask = tasks.find((t) => t.status === "In Progress") || tasks[0];
                setSubmittingTask(pendingTask);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Submit Task</span>
            </button>

            {/* Profile Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(menteeUser.name)}
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline">
                  {menteeUser.name}
                </span>
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{menteeUser.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{menteeUser.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      Intern &bull; {menteeUser.track.split("(")[0]}
                    </span>
                  </div>

                  <div className="py-1">
                    <p className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Role (Testing)
                    </p>
                    <button
                      onClick={() => switchRole("admin")}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Admin Dashboard</span>
                    </button>
                    <button
                      onClick={() => switchRole("mentor")}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>Mentor Dashboard</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Internship Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track your sprint milestones, submit deliverables, and view mentor evaluation feedback.
          </p>
        </div>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Overall Progress */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Progress</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{progressPercentage}%</h2>
            </div>
          </div>

          {/* Tasks Completed */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasks Finished</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {completedCount} / {tasks.length}
              </h2>
            </div>
          </div>

          {/* Attendance */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">98.5%</h2>
            </div>
          </div>

          {/* Average Assignment Score */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mentor Rating</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">94 / 100</h2>
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Encouraging Welcome Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white mb-2">
                  Active Sprint &bull; Frontend Track
                </span>
                <h3 className="text-xl font-bold">Great momentum, {menteeUser.name}! 🚀</h3>
                <p className="text-emerald-100 text-sm mt-1 max-w-xl">
                  You are performing in the top 10% of the cohort. Supervised by{" "}
                  <span className="font-bold underline">{menteeUser.mentor}</span>. Keep up the high code quality!
                </p>
              </div>
              <div>
                <button
                  onClick={() => {
                    const taskToSubmit = tasks.find((t) => t.status === "In Progress") || tasks[0];
                    setSubmittingTask(taskToSubmit);
                  }}
                  className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold px-4 py-2 rounded-lg text-sm shadow-sm transition-colors cursor-pointer"
                >
                  Submit Current Task
                </button>
              </div>
            </div>

            {/* Two Column Grid: Current In-Focus Task & Mentor Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left 2 Cols: Active Task in Focus */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Current Sprint Assignment
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30">
                      Due: Oct 28, 2026
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Build Responsive TMS Dashboard UI
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-xs mt-2 leading-relaxed">
                    Create clean, responsive dashboard components matching the Figma layout. Ensure sidebar is pinned to viewport height, tables feature consistent columns, and form validations are interactive.
                  </p>

                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Status: </span>
                      <span className="font-bold text-amber-600 dark:text-amber-300">Under Mentor Review</span>
                    </div>
                    <button
                      onClick={() => setSubmittingTask(tasks[0])}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Update Submission &rarr;
                    </button>
                  </div>
                </div>

                {/* Recent Completed Work with Mentor Feedback */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                    Recent Evaluation & Feedback
                  </h3>
                  <div className="border border-slate-100 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        State Management with Context API & Reducers
                      </span>
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                        96 / 100
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-200 mt-2 italic leading-relaxed">
                      "{tasks[2]?.mentorFeedback}"
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-300 mt-2 text-right">
                      &bull; Evaluated by Amit Sharma
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Col: Mentor Card & Track Info */}
              <div className="space-y-6">
                {/* Mentor Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-3">
                    Your Assigned Mentor
                  </span>
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 flex items-center justify-center font-bold text-base shadow-xs">
                      AS
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{menteeUser.mentor}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-300">{menteeUser.mentorEmail}</p>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 px-2 py-0.5 rounded">
                        Lead Engineering Mentor
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Supervision Track:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">React Frontend</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Total Tasks Graded:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">2 Completed</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY ASSIGNMENTS */}
        {activeTab === "assignments" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Tasks & Assignments</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete technical milestones and submit code repositories for review.
                </p>
              </div>

              <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-medium">
                {["All", "In Progress", "Submitted", "Completed"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${taskFilter === filter
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 px-2 py-0.5 rounded">
                        {task.track}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          task.status === "Completed"
                            ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                            : task.status === "Submitted"
                            ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                            : "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-3">{task.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                      <span>Due: {task.dueDate}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-100">
                        {task.score !== null ? `Score: ${task.score}/100` : `Priority: ${task.priority}`}
                      </span>
                    </div>

                    {task.submissionUrl && (
                      <div className="mt-2 text-xs">
                        <a
                          href={task.submissionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-300 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                          </svg>
                          <span>Submitted Repo</span>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    {task.status === "Completed" ? (
                      <button
                        onClick={() => setViewingFeedbackTask(task)}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        View Mentor Notes &rarr;
                      </button>
                    ) : (
                      <button
                        onClick={() => setSubmittingTask(task)}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {task.status === "Submitted" ? "Resubmit / Update Link" : "Submit Code Solution"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MENTOR FEEDBACK */}
        {activeTab === "feedback" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mentor Feedback & Reviews</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                    Constructive technical feedback and code review notes provided by {menteeUser.mentor}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Average Score: 94 / 100
                  </div>
                </div>
              </div>

              {/* Feedback Cards */}
              <div className="space-y-4">
                {feedbackTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                          {task.track}
                        </span>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                          {task.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {task.score !== null ? (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                            Score: {task.score}/100
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                            {task.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mentor Feedback Quote */}
                    <div className="mt-4 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                          AS
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {menteeUser.mentor} (Lead Mentor)
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-400">&bull; Review Note</span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed">
                        "{task.mentorFeedback || "No feedback written yet."}"
                      </p>
                    </div>

                    {/* Footer Details */}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 pt-2">
                      <span>Due: {task.dueDate}</span>
                      {task.submissionUrl && (
                        <a
                          href={task.submissionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-300 hover:underline font-mono text-[11px]"
                        >
                          View Repository &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: SUBMIT ASSIGNMENT */}
      {submittingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Submit Deliverable</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{submittingTask.title}</p>
              </div>
              <button
                onClick={() => setSubmittingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/username/project-repo"
                  value={submissionForm.repoUrl}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, repoUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Live Demo URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://my-app.vercel.app"
                  value={submissionForm.demoUrl}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, demoUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Comments / Notes for Mentor
                </label>
                <textarea
                  rows="3"
                  placeholder="Explain your approach, challenges solved, or testing notes..."
                  value={submissionForm.notes}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmittingTask(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW FEEDBACK */}
      {viewingFeedbackTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentor Evaluation</h3>
              <button
                onClick={() => setViewingFeedbackTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="mt-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{viewingFeedbackTask.title}</h4>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Grade:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{viewingFeedbackTask.score}/100</span>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Mentor Review Notes
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                  "{viewingFeedbackTask.mentorFeedback}"
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewingFeedbackTask(null)}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenteeDashboard;
