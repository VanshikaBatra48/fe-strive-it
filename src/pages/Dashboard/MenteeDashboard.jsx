import { useState, useMemo, useRef, useEffect } from "react"; // CHANGED: added useEffect
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import NotificationBell from "../../components/NotificationBell"; // NEW
import { socket } from "../../lib/socket"; // NEW
import useAuth from "../../hooks/useAuth";
import useTasks from "../../hooks/useTasks";

// Helper to get 2-letter initials

function getInitials(name = "") {
  const normalized = typeof name === "string" ? name.trim() : "";
  if (!normalized) return "?";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
}

const MENTEE_STATUS_OPTIONS = [
  { value: "in-progress", label: "In Progress" },
  { value: "hold", label: "On Hold" },
];

const STATUS_LABELS = {
  "in-progress": "In Progress",
  submitted: "Submitted",
  "needs-revision": "Needs Revision",
  complete: "Complete",
  hold: "On Hold",
};

const CATEGORY_LABELS = {
  upskill: "Upskill",
  research: "Research",
  "client-project": "Client Project",
  "inhouse-project": "Inhouse Project",
};

function formatShortDate(val) {
  if (!val) return "-";
  return String(val).slice(0, 10);
}

const MenteeDashboard = () => {
  const navigate = useNavigate();
  const mainRef = useRef(null);

  // Current logged in mentee details from AuthContext
  const { user: authUser, loading: authLoading, logout } = useAuth();
  const menteeUser = useMemo(() => {
    const rawTrack = typeof authUser?.track === "string" ? authUser.track.trim() : "";
    return {
      id: authUser?.id || null,
      name: authUser?.name || "Mentee",
      email: authUser?.email || "",
      role: authUser?.role || "mentee",
      status: authUser?.status || "active",
      track: rawTrack,
      mentor:
        authUser?.assigned_to ||
        (typeof authUser?.mentor === "object" ? authUser.mentor?.name : authUser?.mentor) ||
        "Unassigned",
      mentorEmail: authUser?.mentorEmail || "",
      attendance: authUser?.attendance || "100%",
    };
  }, [authUser]);

  const {
    tasks: allTasks,
    loading: tasksLoading,
    error: tasksError,
    submitTask,
    updateTaskStatus,
    refetch, // NEW: your useTasks hook must return this (see note below the code)
  } = useTasks();

  // NEW: when a notification arrives over the socket, reload the task list
  useEffect(() => {
    if (!refetch) return;
    const onNewNotification = () => refetch();
    socket.on("notification:new", onNewNotification);
    return () => socket.off("notification:new", onNewNotification);
  }, [refetch]);

  // Filter tasks strictly for this logged-in mentee from the database
  const tasks = useMemo(() => {
    return allTasks.filter(
      (t) =>
        (menteeUser.id && (t.mentee_id === menteeUser.id || t.mentee?.id === menteeUser.id)) ||
        (menteeUser.email && t.mentee?.email?.toLowerCase() === menteeUser.email.toLowerCase())
    );
  }, [allTasks, menteeUser]);

  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [submitError, setSubmitError] = useState("");

  // State: "dashboard", "assignments", "feedback"
  const [activeTab, setActiveTab] = useState("dashboard");
  const [taskFilter, setTaskFilter] = useState("All");

  // Dropdown & Modals
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(null);
  const [viewingFeedbackTask, setViewingFeedbackTask] = useState(null);

  // Submission Form State (matches backend PATCH /api/tasks/:id/submit)
  const [submissionForm, setSubmissionForm] = useState({
    submission_url: "",
    demo_url: "",
    submission_notes: "",
  });

  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter === "All") return true;
      return (t.status || "").toLowerCase() === taskFilter.toLowerCase();
    });
  }, [tasks, taskFilter]);

  // Tasks with mentor feedback or evaluations
  const feedbackTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        Boolean(t.feedback) ||
        t.status === "complete" ||
        t.status === "submitted" ||
        t.status === "needs-revision"
    );
  }, [tasks]);

  // Evaluated tasks & dynamic average score
  const evaluatedTasks = useMemo(
    () => tasks.filter((t) => typeof t.score === "number" && !isNaN(t.score)),
    [tasks]
  );
  const avgScore = useMemo(() => {
    if (evaluatedTasks.length === 0) return null;
    return Math.round(
      evaluatedTasks.reduce((acc, t) => acc + t.score, 0) / evaluatedTasks.length
    );
  }, [evaluatedTasks]);

  // Overall Progress
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "complete").length,
    [tasks]
  );
  const progressPercentage =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const focusTask = useMemo(() => {
    return (
      tasks.find((t) => t.status === "in-progress" || t.status === "needs-revision") ||
      tasks.find((t) => t.status === "submitted") ||
      tasks[0] ||
      null
    );
  }, [tasks]);

  const recentEvaluatedTask = useMemo(() => {
    return tasks.find((t) => Boolean(t.feedback) || t.status === "complete") || null;
  }, [tasks]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const openSubmitModal = (task) => {
    if (!task) return;
    setSubmitError("");
    setSubmittingTask(task);
    setSubmissionForm({
      submission_url: task.submission_url || "",
      demo_url: task.demo_url || "",
      submission_notes: task.submission_notes || "",
    });
  };

  // NEW: clicking a notification takes the mentee to the Assignments tab
  const handleOpenTaskFromNotification = () => {
    setActiveTab("assignments");
    setTaskFilter("All");
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Status update handler: Mentee can only set in-progress or hold.
  // Submitted, complete, and needs-revision tasks are locked.
  const handleStatusChange = async (taskId, nextStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === "submitted" || task.status === "complete" || task.status === "needs-revision") {
      showToast("error", "Task is locked. You cannot change the status of a submitted or evaluated task.");
      return;
    }
    if (nextStatus !== "in-progress" && nextStatus !== "hold") {
      showToast("error", "You can only set status to In Progress or On Hold.");
      return;
    }
    const res = await updateTaskStatus(taskId, nextStatus);
    if (res.success) {
      showToast("success", `Task status updated to ${STATUS_LABELS[nextStatus] || nextStatus}`);
    } else {
      showToast("error", res.error || "Failed to update task status");
    }
  };

  // Submit task handler
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!submittingTask) return;
    setSubmitError("");

    const payload = {
      submission_url: submissionForm.submission_url.trim(),
      demo_url: submissionForm.demo_url.trim() || null,
      submission_notes: submissionForm.submission_notes.trim() || null,
    };

    setActionLoading(true);
    const res = await submitTask(submittingTask.id, payload);
    setActionLoading(false);

    if (res.success) {
      setSubmittingTask(null);
      setSubmissionForm({ submission_url: "", demo_url: "", submission_notes: "" });
      showToast("success", "Deliverables submitted successfully! Your mentor has been notified.");
    } else {
      setSubmitError(res.error || "Failed to submit assignment");
    }
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

            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/60"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Messages</span>
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

            {/* NEW: Notification bell */}
            <NotificationBell role="mentee" onOpenTask={handleOpenTaskFromNotification} />

            {/* Messages Button */}
            <button
              type="button"
              onClick={() => navigate("/chat")}
              title="Messages"
              aria-label="Messages"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Messages</span>
            </button>

            {/* Quick Submit Button */}
            <button
              onClick={() => openSubmitModal(focusTask)}
              disabled={!focusTask || focusTask.status === "submitted" || focusTask.status === "complete"}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>
                {focusTask?.status === "needs-revision"
                  ? "Re-submit Task"
                  : focusTask?.status === "submitted"
                  ? "Under Review"
                  : focusTask?.status === "complete"
                  ? "Completed"
                  : "Submit Task"}
              </span>
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
                  {authLoading && !authUser ? "Loading..." : menteeUser.name}
                </span>
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {authLoading && !authUser ? "Loading profile..." : menteeUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {menteeUser.email || (authLoading ? "Fetching account..." : "No email")}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 capitalize">
                      Intern &bull; {menteeUser.track ? menteeUser.track.split("(")[0].trim() : menteeUser.status}
                    </span>
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

        {/* Notification Toast */}
        {notification && (
          <div
            className={`mb-5 p-3.5 rounded-xl text-sm flex items-center justify-between shadow-xs animate-fadeIn border ${
              notification.type === "error"
                ? "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === "error" ? (
                <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="hover:opacity-75 text-lg font-bold cursor-pointer leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {tasksError && (
          <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{tasksError}</span>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {tasksLoading && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="font-medium">Loading your assignments and feedback...</span>
          </div>
        )}

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
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{menteeUser.attendance || "100%"}</h2>
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
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{avgScore !== null ? `${avgScore} / 100` : "N/A"}</h2>
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
                  Intern Workspace &bull; {tasks.length} Assigned {tasks.length === 1 ? "Task" : "Tasks"}
                </span>
                <h3 className="text-xl font-bold">Welcome back, {menteeUser.name}!</h3>
                <p className="text-emerald-100 text-sm mt-1 max-w-xl">
                  {menteeUser.mentor && menteeUser.mentor !== "Unassigned" ? (
                    <>
                      Supervised by <span className="font-bold underline">{menteeUser.mentor}</span>. You have completed{" "}
                      <span className="font-bold">{completedCount}</span> of {tasks.length} assigned tasks.
                    </>
                  ) : (
                    <>
                      You have completed <span className="font-bold">{completedCount}</span> of {tasks.length} assigned tasks.
                    </>
                  )}
                </p>
              </div>
              <div>
                <button
                  disabled={!focusTask || focusTask.status === "submitted" || focusTask.status === "complete"}
                  onClick={() => openSubmitModal(focusTask)}
                  className="bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold px-4 py-2 rounded-lg text-sm shadow-sm transition-colors cursor-pointer"
                >
                  {focusTask?.status === "submitted"
                    ? "Under Review"
                    : focusTask?.status === "complete"
                    ? "Completed"
                    : focusTask?.status === "needs-revision"
                    ? "Re-submit Task"
                    : "Submit Current Task"}
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
                      Current Focus Assignment
                    </span>
                    {focusTask && (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30">
                        Due: {formatShortDate(focusTask.due_date)}
                      </span>
                    )}
                  </div>

                  {focusTask ? (
                    <>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {focusTask.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-300 text-xs mt-2 leading-relaxed">
                        {focusTask.description}
                      </p>

                      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">Status:</span>
                          {focusTask.status === "submitted" || focusTask.status === "complete" || focusTask.status === "needs-revision" ? (
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                focusTask.status === "complete"
                                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                  : focusTask.status === "submitted"
                                  ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                  : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                              }`}
                            >
                              {STATUS_LABELS[focusTask.status] || focusTask.status}
                            </span>
                          ) : (
                            <select
                              aria-label={`Change status for ${focusTask.title}`}
                              value={focusTask.status}
                              onChange={(e) => handleStatusChange(focusTask.id, e.target.value)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                              {MENTEE_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {focusTask.status === "complete" ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            Completed & Evaluated
                          </span>
                        ) : focusTask.status === "submitted" ? (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                            Under Review
                          </span>
                        ) : focusTask.status === "needs-revision" ? (
                          <button
                            onClick={() => openSubmitModal(focusTask)}
                            className="text-xs font-bold text-rose-600 dark:text-rose-300 hover:underline cursor-pointer"
                          >
                            Re-submit Work &rarr;
                          </button>
                        ) : (
                          <button
                            onClick={() => openSubmitModal(focusTask)}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline cursor-pointer"
                          >
                            Submit Work &rarr;
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      No tasks assigned yet. Check back once your mentor assigns your first task.
                    </div>
                  )}
                </div>

                {/* Recent Completed Work with Mentor Feedback */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                    Recent Evaluation & Feedback
                  </h3>
                  {recentEvaluatedTask ? (
                    <div className="border border-slate-100 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {recentEvaluatedTask.title}
                        </span>
                        {recentEvaluatedTask.score !== null && recentEvaluatedTask.score !== undefined ? (
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                            {recentEvaluatedTask.score} / 100
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {STATUS_LABELS[recentEvaluatedTask.status] || recentEvaluatedTask.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-200 mt-2 italic leading-relaxed">
                        &ldquo;{recentEvaluatedTask.feedback || "No feedback notes provided yet."}&rdquo;
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-300 mt-2 text-right">
                        &bull; Evaluated by {recentEvaluatedTask.evaluator?.name || recentEvaluatedTask.assigner?.name || menteeUser.mentor}
                      </p>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                      No evaluated tasks yet.
                    </div>
                  )}
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
                      {getInitials(menteeUser.mentor)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{menteeUser.mentor}</h4>
                      {menteeUser.mentorEmail && (
                        <p className="text-xs text-slate-500 dark:text-slate-300">{menteeUser.mentorEmail}</p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 px-2 py-0.5 rounded">
                        Assigned Mentor
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Pending Submissions:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {tasks.filter((t) => t.status === "in-progress" || t.status === "needs-revision").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Total Tasks Graded:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {evaluatedTasks.length} Graded
                      </span>
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

              <div className="flex flex-wrap bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-medium">
                {["All", "in-progress", "submitted", "needs-revision", "complete", "hold"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${taskFilter === filter
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {filter === "All" ? "All" : STATUS_LABELS[filter] || filter}
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 px-2 py-0.5 rounded">
                        {CATEGORY_LABELS[task.category] || task.category}
                      </span>
                      {task.status === "submitted" || task.status === "complete" || task.status === "needs-revision" ? (
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            task.status === "complete"
                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                              : task.status === "submitted"
                              ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                              : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                          }`}
                        >
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
                      ) : (
                        <select
                          aria-label={`Change status for ${task.title}`}
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border cursor-pointer focus:outline-none ${
                            task.status === "hold"
                              ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600"
                              : "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                          }`}
                        >
                          {MENTEE_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-3">{task.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                      <span>Due: {formatShortDate(task.due_date)} &bull; {task.estimated_hours}h</span>
                      <span className="font-bold uppercase text-[11px] text-slate-700 dark:text-slate-100">
                        {task.score !== null && task.score !== undefined ? `Score: ${task.score}/100` : `Priority: ${task.priority}`}
                      </span>
                    </div>

                    {task.submission_url && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <a
                          href={task.submission_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-300 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                          </svg>
                          <span>Submitted Link</span>
                        </a>
                        {task.demo_url && (
                          <a
                            href={task.demo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-300 hover:underline font-mono text-[11px]"
                          >
                            Live Demo
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                    {task.status === "complete" ? (
                      <button
                        onClick={() => setViewingFeedbackTask(task)}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        View Mentor Notes &rarr;
                      </button>
                    ) : task.status === "submitted" ? (
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                          Under Review
                        </span>
                        {task.feedback && (
                          <button
                            onClick={() => setViewingFeedbackTask(task)}
                            className="text-xs font-semibold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            View Notes
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {task.feedback && (
                          <button
                            onClick={() => setViewingFeedbackTask(task)}
                            className="text-xs font-semibold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer flex-shrink-0"
                          >
                            View Notes
                          </button>
                        )}
                        <button
                          onClick={() => openSubmitModal(task)}
                          className={`w-full py-1.5 text-white rounded text-xs font-semibold transition-colors cursor-pointer ${
                            task.status === "needs-revision"
                              ? "bg-rose-600 hover:bg-rose-700"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                        >
                          {task.status === "needs-revision" ? "Re-submit Work" : "Submit Work"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {filteredTasks.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    No tasks found in the database.
                  </p>
                </div>
              )}
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
                    {avgScore !== null ? `Average Score: ${avgScore} / 100` : "No ratings yet"}
                  </div>
                </div>
              </div>

              {/* Feedback Cards */}
              <div className="space-y-4">
                {feedbackTasks.map((task) => {
                  const reviewer = task.evaluator?.name || task.assigner?.name || menteeUser.mentor;
                  return (
                    <div
                      key={task.id}
                      className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                            {CATEGORY_LABELS[task.category] || task.category}
                          </span>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                            {task.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {task.score !== null && task.score !== undefined ? (
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                              Score: {task.score}/100
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                              {STATUS_LABELS[task.status] || task.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mentor Feedback Quote */}
                      <div className="mt-4 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                            {getInitials(reviewer)}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {reviewer} (Mentor)
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-400">&bull; Review Note</span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed">
                          &ldquo;{task.feedback || "No feedback written yet."}&rdquo;
                        </p>
                      </div>

                      {/* Footer Details */}
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 pt-2">
                        <span>Due: {formatShortDate(task.due_date)}</span>
                        {task.submission_url && (
                          <a
                            href={task.submission_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 dark:text-emerald-300 hover:underline font-mono text-[11px]"
                          >
                            View Submission &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {feedbackTasks.length === 0 && (
                  <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      No reviewed assignments or feedback available in the database yet.
                    </p>
                  </div>
                )}
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
              {submitError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Submission URL (GitHub / Document) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/username/project-repo"
                  value={submissionForm.submission_url}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, submission_url: e.target.value })}
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
                  value={submissionForm.demo_url}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, demo_url: e.target.value })}
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
                  value={submissionForm.submission_notes}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, submission_notes: e.target.value })}
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
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? "Submitting..." : "Submit for Review"}
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
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {viewingFeedbackTask.score !== null && viewingFeedbackTask.score !== undefined
                    ? `${viewingFeedbackTask.score}/100`
                    : "Pending grade"}
                </span>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Mentor Review Notes
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                  &ldquo;{viewingFeedbackTask.feedback || "No feedback written yet."}&rdquo;
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