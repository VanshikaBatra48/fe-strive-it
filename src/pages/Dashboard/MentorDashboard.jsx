import { useState, useMemo, useRef ,useEffect} from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import NotificationBell from "../../components/NotificationBell";
import useAuth from "../../hooks/useAuth";
import useMentors from "../../hooks/useMentors";
import useTasks from "../../hooks/useTasks";
import { socket } from "../../lib/socket";


function getInitials(name = "") {
  const normalized = typeof name === "string" ? name.trim() : "";
  if (!normalized) return "?";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
}

const TASK_CATEGORIES = [
  { value: "upskill", label: "Upskill" },
  { value: "research", label: "Research" },
  { value: "client-project", label: "Client Project" },
  { value: "inhouse-project", label: "Inhouse Project" },
];

const CATEGORY_LABELS = {
  upskill: "Upskill",
  research: "Research",
  "client-project": "Client Project",
  "inhouse-project": "Inhouse Project",
};

const STATUS_LABELS = {
  "in-progress": "In Progress",
  submitted: "Submitted",
  "needs-revision": "Needs Revision",
  complete: "Complete",
  hold: "On Hold",
};

function formatShortDate(val) {
  if (!val) return "-";
  return String(val).slice(0, 10);
}

const MentorDashboard = () => {
  const navigate = useNavigate();
  const mainRef = useRef(null);

  // Today's date string YYYY-MM-DD for date validation
  const todayDateString = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Current logged in mentor details from AuthContext
  const { user: authUser, logout } = useAuth();
  const mentorUser = authUser || {
    name: "Mentor",
    email: "",
    role: "mentor",
  };

  const {
    assignedMentees,
    loading: menteesLoading,
    error: menteesError,
    deleteMentee,
  } = useMentors(mentorUser.name);

  // Only database assigned mentees
  const mentees = assignedMentees;

  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    assignTask,
    evaluateTask,
    deleteTask,
    removeTasksByMenteeId,
    refetch: refetchTasks,
  } = useTasks();

  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // State
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard", "mentees", "tasks", "reports"

  // Filters
  const [menteeSearch, setMenteeSearch] = useState("");
  const [menteeFilter, setMenteeFilter] = useState("All");
  const [taskFilter, setTaskFilter] = useState("All");

  // User Dropdown & Modals
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [viewingMentee, setViewingMentee] = useState(null);
  const [deletingMentee, setDeletingMentee] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [evaluatingTask, setEvaluatingTask] = useState(null);
  const [assignError, setAssignError] = useState("");
  const [evalError, setEvalError] = useState("");

  // New Task Form (matches backend POST /api/tasks fields)
  const [newTask, setNewTask] = useState({
    title: "",
    mentee_id: "",
    category: "upskill",
    priority: "medium",
    start_date: todayDateString,
    due_date: todayDateString,
    estimated_hours: 4,
    description: "",
  });

  const [dateError, setDateError] = useState("");

  // Evaluation Form (matches backend PATCH /api/tasks/:id/evaluate fields)
  const [evaluation, setEvaluation] = useState({
    score: 90,
    feedback: "",
    status: "complete",
  });

  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered Mentees
  const filteredMentees = useMemo(() => {
    return mentees.filter((m) => {
      const matchesSearch = `${m.name || ""} ${m.email || ""} ${m.track || ""}`
        .toLowerCase()
        .includes(menteeSearch.toLowerCase());
      const matchesFilter =
        menteeFilter === "All" || (m.status || "").toLowerCase() === menteeFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [mentees, menteeSearch, menteeFilter]);

  // Dynamic per-mentee stats derived from live tasks
  const menteeStatsMap = useMemo(() => {
    const map = {};
    for (const m of mentees) {
      const mTasks = tasks.filter((t) => t.mentee_id === m.id || t.mentee?.id === m.id);
      const completed = mTasks.filter((t) => t.status === "complete").length;
      const active =
        mTasks.find((t) => t.status === "in-progress") ||
        mTasks.find((t) => t.status === "needs-revision") ||
        mTasks.find((t) => t.status === "submitted") ||
        mTasks[0];
      map[m.id] = {
        taskCount: mTasks.length,
        completedCount: completed,
        progress: mTasks.length > 0 ? Math.round((completed / mTasks.length) * 100) : 0,
        currentTask: active ? active.title : "No active task",
      };
    }
    return map;
  }, [mentees, tasks]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter === "All") return true;
      return (t.status || "").toLowerCase() === taskFilter.toLowerCase();
    });
  }, [tasks, taskFilter]);

  // Pending reviews & metrics
  const pendingReviewsCount = useMemo(
    () => tasks.filter((t) => t.status === "submitted").length,
    [tasks]
  );

  const avgScore = useMemo(() => {
    const graded = tasks.filter((t) => typeof t.score === "number");
    if (graded.length === 0) return null;
    const sum = graded.reduce((acc, t) => acc + t.score, 0);
    return Math.round((sum / graded.length) * 10) / 10;
  }, [tasks]);

  const completionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.status === "complete").length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  const topPerformer = useMemo(() => {
    const graded = tasks.filter((t) => typeof t.score === "number");
    if (graded.length === 0) return null;
    const best = graded.reduce((max, t) => (t.score > max.score ? t : max), graded[0]);
    return {
      name: best.mentee?.name || "Mentee",
      score: best.score,
    };
  }, [tasks]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleOpenTaskFromNotification = () => {
    setActiveTab("tasks");
    setTaskFilter("All");
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openAssignModal = (preferredMenteeId = "") => {
    setDateError("");
    setAssignError("");
    setNewTask((prev) => ({
      ...prev,
      mentee_id: preferredMenteeId
        ? String(preferredMenteeId)
        : mentees[0]?.id
          ? String(mentees[0].id)
          : "",
      start_date: prev.start_date || todayDateString,
      due_date: prev.due_date || todayDateString,
    }));
    setShowAssignModal(true);
  };

  // Assign task handler matching backend POST /api/tasks schema
  const handleAssignTask = async (e) => {
    e.preventDefault();
    setAssignError("");

    if (!newTask.title.trim() || newTask.title.trim().length < 3) {
      setAssignError("Title must be at least 3 characters.");
      return;
    }

    const targetMenteeId = Number(newTask.mentee_id || mentees[0]?.id);
    if (!targetMenteeId) {
      setAssignError("Please select an assigned mentee.");
      return;
    }

    if (!newTask.start_date || !newTask.due_date) {
      setDateError("Please provide both start date and due date.");
      return;
    }

    if (newTask.due_date < todayDateString) {
      setDateError("Due date cannot be in the past.");
      return;
    }

    if (newTask.due_date < newTask.start_date) {
      setDateError("Due date must be on or after the start date.");
      return;
    }

    if (!newTask.description.trim()) {
      setAssignError("Task description is required.");
      return;
    }

    const estimatedHours = Number(newTask.estimated_hours);
    if (!Number.isInteger(estimatedHours) || estimatedHours <= 0) {
      setAssignError("Estimated hours must be a positive whole number.");
      return;
    }

    setDateError("");
    const payload = {
      title: newTask.title.trim(),
      mentee_id: targetMenteeId,
      category: newTask.category,
      priority: newTask.priority,
      start_date: newTask.start_date,
      due_date: newTask.due_date,
      estimated_hours: estimatedHours,
      description: newTask.description.trim(),
    };

    setActionLoading(true);
    const res = await assignTask(payload);
    setActionLoading(false);

    if (res.success) {
      const selectedMentee = mentees.find((m) => m.id === targetMenteeId);
      setShowAssignModal(false);
      setNewTask({
        title: "",
        mentee_id: mentees[0]?.id ? String(mentees[0].id) : "",
        category: "upskill",
        priority: "medium",
        start_date: todayDateString,
        due_date: todayDateString,
        estimated_hours: 4,
        description: "",
      });
      showToast(
        "success",
        `Task assigned to ${selectedMentee?.name || "mentee"} successfully!`
      );
    } else {
      setAssignError(res.error || "Failed to assign task");
    }
  };

  // Evaluate submission handler
  const handleEvaluateSubmission = async (e) => {
    e.preventDefault();
    if (!evaluatingTask) return;
    setEvalError("");

    if (!evaluation.feedback.trim()) {
      setEvalError("Evaluation feedback is required.");
      return;
    }

    if (
      evaluation.status === "complete" &&
      (evaluation.score === "" || evaluation.score === null || evaluation.score === undefined)
    ) {
      setEvalError("Score (0 - 100) is required when marking a task complete.");
      return;
    }

    setActionLoading(true);
    const res = await evaluateTask(evaluatingTask.id, {
      status: evaluation.status,
      score:
        evaluation.score === "" || evaluation.score === null || evaluation.score === undefined
          ? null
          : Math.round(Number(evaluation.score)),
      feedback: evaluation.feedback.trim(),
    });
    setActionLoading(false);

    if (res.success) {
      setEvaluatingTask(null);
      showToast("success", "Evaluation submitted successfully!");
    } else {
      setEvalError(res.error || "Failed to submit evaluation");
    }
  };

  // Delete single task
  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    const res = await deleteTask(task.id);
    if (res.success) {
      showToast("success", `Task "${task.title}" deleted.`);
    } else {
      showToast("error", res.error || "Failed to delete task");
    }
  };

  useEffect(() => {
    if (!refetchTasks) return;
    const onNewNotification = () => refetchTasks();
    socket.on("notification:new", onNewNotification);
    return () => socket.off("notification:new", onNewNotification);
  }, [refetchTasks]);

  // Confirm delete mentee + cascade tasks
  const handleConfirmDeleteMentee = async () => {
    if (!deletingMentee) return;
    const target = deletingMentee;
    setActionLoading(true);
    const res = await deleteMentee(target.id);
    if (res.success) {
      removeTasksByMenteeId(target.id);
      await refetchTasks();
      if (viewingMentee?.id === target.id) {
        setViewingMentee(null);
      }
      setDeletingMentee(null);
      const countMsg =
        res.deletedTasksCount > 0
          ? ` (${res.deletedTasksCount} assigned task${res.deletedTasksCount > 1 ? "s" : ""} deleted)`
          : "";
      showToast("success", `${target.name} has been deleted${countMsg}.`);
    } else {
      setDeletingMentee(null);
      showToast("error", res.error || "Failed to delete mentee");
    }
    setActionLoading(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sidebar - Viewport pinned */}
      <aside className="w-64 h-screen bg-[#111827] flex-shrink-0 flex flex-col justify-between border-r border-slate-800 z-30 select-none">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className="p-6 pb-6 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-white">
              <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-wide">
                TMS Mentor
              </span>
              <span className="block text-[10px] uppercase font-semibold text-indigo-400 tracking-wider">
                Mentorship Portal
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
                  ? "bg-indigo-600 text-white shadow-xs"
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
                setActiveTab("mentees");
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "mentees"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <div className="flex items-center gap-3.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>My Mentees</span>
              </div>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                {mentees.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("tasks");
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "tasks"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <div className="flex items-center gap-3.5">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Assignments</span>
              </div>
              {pendingReviewsCount > 0 && (
                <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {pendingReviewsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("reports");
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "reports"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Performance</span>
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
              <div className="w-9 h-9 rounded-full bg-indigo-900/60 text-indigo-200 border border-indigo-700/50 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {getInitials(mentorUser.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{mentorUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{mentorUser.email}</p>
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
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Mentor Hub</span>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Dark Mode Toggle Button */}
            <ThemeToggle />

            {/* Notification Bell */}
            <NotificationBell role="mentor" onOpenTask={handleOpenTaskFromNotification} />

            {/* Messages Button */}
            <button
              type="button"
              onClick={() => navigate("/chat")}
              title="Messages"
              aria-label="Messages"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Messages</span>
            </button>

            {/* Quick Action Button */}
            <button
              onClick={() => openAssignModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Assign Task</span>
            </button>

            {/* Profile Menu Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(mentorUser.name)}
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline">
                  {mentorUser.name}
                </span>
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{mentorUser.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{mentorUser.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                      Active Mentor
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
            className={`mb-5 p-3.5 rounded-xl text-sm flex items-center justify-between shadow-xs animate-fadeIn border ${notification.type === "error"
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
        {(menteesError || tasksError) && (
          <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{menteesError || tasksError}</span>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {(menteesLoading || tasksLoading) && (
          <div className="mb-5 p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="font-medium">Syncing mentor data from backend...</span>
          </div>
        )}

        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Mentor Workspace
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Guide interns, evaluate project code submissions, and track engineering progress.
          </p>
        </div>

        {/* Top Stat KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Assigned Mentees */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned Mentees</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{mentees.length} Interns</h2>
            </div>
          </div>

          {/* Pending Submissions */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Reviews</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{pendingReviewsCount} Tasks</h2>
            </div>
          </div>

          {/* Active Tasks in Progress */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasks Managed</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {tasks.length} Total
              </h2>
            </div>
          </div>

          {/* Average Performance */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg. Score</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {avgScore !== null ? `${avgScore}%` : "N/A"}
              </h2>
            </div>
          </div>
        </div>

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Action Banner */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white mb-2">
                  Mentorship Overview &bull; Live Cohort
                </span>
                <h3 className="text-xl font-bold">Welcome back, {mentorUser.name}!</h3>
                <p className="text-indigo-100 text-sm mt-1 max-w-xl">
                  You have <span className="font-bold underline">{pendingReviewsCount} submissions</span> waiting for your technical review and code evaluation.
                </p>
              </div>
              <div>
                <button
                  onClick={() => openAssignModal()}
                  className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold px-4 py-2 rounded-lg text-sm shadow-sm transition-colors cursor-pointer"
                >
                  + Assign New Task
                </button>
              </div>
            </div>

            {/* Submissions Waiting for Review */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Submissions Requiring Evaluation
                </h3>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  View All Tasks &rarr;
                </button>
              </div>

              {tasks.filter((t) => t.status === "submitted").length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">All submissions are up to date!</p>
                  <p className="text-xs text-slate-400 mt-1">No pending reviews from your assigned mentees.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {tasks
                    .filter((t) => t.status === "submitted")
                    .map((task) => (
                      <div key={task.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {task.title}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30">
                              {task.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                            Submitted by <span className="font-medium text-slate-700 dark:text-slate-100">{task.mentee?.name || "Mentee"}</span> &bull; Due: {formatShortDate(task.due_date)}
                          </p>
                          {task.submission_url && (
                            <a
                              href={task.submission_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline mt-1"
                            >
                              <span>Submission Link</span>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setEvalError("");
                            setEvaluatingTask(task);
                            setEvaluation({
                              score: task.score ?? 90,
                              feedback: task.feedback || "",
                              status: "complete",
                            });
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex-shrink-0"
                        >
                          Review & Grade
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY MENTEES */}
        {activeTab === "mentees" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
            {/* Header with Search & Filter */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assigned Mentees</h2>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                  Track individual progress, assign tasks, and review internship development.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search mentee name, track..."
                    value={menteeSearch}
                    onChange={(e) => setMenteeSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <select
                  value={menteeFilter}
                  onChange={(e) => setMenteeFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Mentees Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {filteredMentees.map((mentee) => {
                const stats = menteeStatsMap[mentee.id] || {
                  taskCount: 0,
                  completedCount: 0,
                  progress: 0,
                  currentTask: "No active task",
                };
                return (
                  <div
                    key={mentee.id}
                    className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-5 hover:shadow-md transition-shadow bg-white dark:bg-slate-800/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${mentee.avatarBg}`}>
                            {getInitials(mentee.name)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{mentee.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-300">{mentee.email}</p>
                            <span className="inline-block mt-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/60 dark:border-indigo-500/30 px-2 py-0.5 rounded">
                              {stats.taskCount} {stats.taskCount === 1 ? "Task" : "Tasks"}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${mentee.status === "Active"
                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                              : "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                            }`}
                        >
                          {mentee.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-5">
                        <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                          <span>Task Completion Progress</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-300">{stats.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${stats.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Current Task & Completed Info */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/80 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-semibold">Completed</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {stats.completedCount} / {stats.taskCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-semibold">Current Task</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate block">{stats.currentTask}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewingMentee(mentee)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => setDeletingMentee(mentee)}
                          className="px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete mentee and all their assigned tasks"
                        >
                          Delete
                        </button>
                      </div>
                      <button
                        onClick={() => openAssignModal(mentee.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        + Assign Task
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredMentees.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    No mentees found in the database.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ASSIGNMENTS & TASKS */}
        {activeTab === "tasks" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assignments & Evaluation</h2>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                  Review code submissions, approve deliverables, and provide constructive feedback.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex flex-wrap bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-medium">
                  {["All", "in-progress", "submitted", "needs-revision", "complete", "hold"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTaskFilter(filter)}
                      className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${taskFilter === filter
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                      {filter === "All" ? "All" : STATUS_LABELS[filter] || filter}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => openAssignModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Task</span>
                </button>
              </div>
            </div>

            {/* Tasks Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Task Title</th>
                    <th className="px-6 py-3.5">Mentee</th>
                    <th className="px-6 py-3.5">Priority</th>
                    <th className="px-6 py-3.5">Due Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Score</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80 text-xs">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{task.title}</p>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {CATEGORY_LABELS[task.category] || task.category}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-300 text-xs line-clamp-1 mt-0.5">{task.description}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{task.mentee?.name || "Mentee"}</span>
                        <span className="block text-[11px] text-slate-400 dark:text-slate-400">{task.mentee?.email || ""}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${task.priority === "high"
                              ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                              : task.priority === "medium"
                                ? "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30"
                                : "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30"
                            }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                        {formatShortDate(task.due_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-block border ${task.status === "complete"
                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/30"
                              : task.status === "submitted"
                                ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-500/30"
                                : task.status === "needs-revision"
                                  ? "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-500/30"
                                  : task.status === "hold"
                                    ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600"
                                    : "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-500/30"
                            }`}
                        >
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700 dark:text-slate-100">
                        {task.score !== null && task.score !== undefined ? `${task.score}/100` : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {task.status === "submitted" || (task.status === "needs-revision" && task.submission_url) ? (
                            <button
                              onClick={() => {
                                setEvalError("");
                                setEvaluatingTask(task);
                                setEvaluation({
                                  score: task.score ?? 90,
                                  feedback: task.feedback || "",
                                  status: "complete",
                                });
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Grade & Feedback
                            </button>
                          ) : task.status === "complete" || task.feedback ? (
                            <button
                              onClick={() => {
                                setEvalError("");
                                setEvaluatingTask(task);
                                setEvaluation({
                                  score: task.score ?? "",
                                  feedback: task.feedback || "",
                                  status: task.status === "needs-revision" ? "needs-revision" : "complete",
                                });
                              }}
                              className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold px-2 py-1 text-xs cursor-pointer"
                            >
                              View Evaluation
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">Awaiting submission</span>
                          )}
                          <button
                            onClick={() => handleDeleteTask(task)}
                            title="Delete task"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No tasks found in the database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: REPORTS & METRICS */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Cohort Performance Analytics</h2>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
                Aggregated performance breakdown for mentees supervised by {mentorUser.name}.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">Task Completion Rate</span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{completionRate}%</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1">
                    {tasks.filter((t) => t.status === "complete").length} of {tasks.length} tasks complete
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">Average Assignment Score</span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {avgScore !== null ? `${avgScore} / 100` : "No scores yet"}
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-1">
                    {topPerformer ? `Highest: ${topPerformer.name} (${topPerformer.score}/100)` : "Evaluate submissions to see scores"}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">Active Mentees Supervised</span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {mentees.filter((m) => m.status === "Active").length}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{mentees.length} total assigned</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ASSIGN TASK (WITH PAST-DATE RESTRICTION) */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign New Task</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="mt-4 space-y-4">
              {assignError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium">
                  {assignError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  placeholder="e.g. Implement Redux Toolkit Store"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Assign To Mentee <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newTask.mentee_id}
                  onChange={(e) => setNewTask({ ...newTask, mentee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {mentees.length === 0 ? (
                    <option value="">No mentees assigned</option>
                  ) : (
                    mentees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    {TASK_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newTask.start_date}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setNewTask({ ...newTask, start_date: selected });
                      if (selected && newTask.due_date && newTask.due_date < selected) {
                        setDateError("Due date must be on or after the start date.");
                      } else {
                        setDateError("");
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:[color-scheme:dark] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Due Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={newTask.start_date || todayDateString}
                    value={newTask.due_date}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setNewTask({ ...newTask, due_date: selected });
                      if (selected && selected < todayDateString) {
                        setDateError("Due date cannot be in the past!");
                      } else if (selected && newTask.start_date && selected < newTask.start_date) {
                        setDateError("Due date must be on or after start date!");
                      } else {
                        setDateError("");
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 dark:[color-scheme:dark] cursor-pointer ${dateError
                        ? "border-rose-400 focus:ring-rose-400/20"
                        : "border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20"
                      }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Estimated Hours <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={newTask.estimated_hours}
                  onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {dateError && (
                <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{dateError}</span>
                </p>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Description & Deliverables <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Details, technical acceptance criteria, resources..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || mentees.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? "Assigning..." : "Create & Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EVALUATE TASK SUBMISSION */}
      {evaluatingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full p-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Evaluate Code Submission</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {evaluatingTask.mentee?.name || "Mentee"} &bull; {evaluatingTask.title}
                </p>
              </div>
              <button
                onClick={() => setEvaluatingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700 text-xs space-y-1.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Deliverables:</p>
              {evaluatingTask.submission_url ? (
                <a
                  href={evaluatingTask.submission_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline block font-mono break-all"
                >
                  Submission: {evaluatingTask.submission_url}
                </a>
              ) : (
                <p className="text-slate-400 italic">No submission URL provided</p>
              )}
              {evaluatingTask.demo_url && (
                <a
                  href={evaluatingTask.demo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline block font-mono break-all"
                >
                  Demo: {evaluatingTask.demo_url}
                </a>
              )}
              {evaluatingTask.submission_notes && (
                <p className="text-slate-600 dark:text-slate-300 pt-1">
                  <span className="font-semibold">Notes:</span> {evaluatingTask.submission_notes}
                </p>
              )}
            </div>

            <form onSubmit={handleEvaluateSubmission} className="mt-4 space-y-4">
              {evalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium">
                  {evalError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Score (0 - 100){evaluation.status === "complete" ? " *" : ""}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required={evaluation.status === "complete"}
                    value={evaluation.score}
                    onChange={(e) => setEvaluation({ ...evaluation, score: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Status Outcome
                  </label>
                  <select
                    value={evaluation.status}
                    onChange={(e) => setEvaluation({ ...evaluation, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="complete">Approved</option>
                    <option value="needs-revision">Need Revision</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Mentor Feedback & Code Review Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="Explain architectural strengths, code readability, performance, and areas for improvement..."
                  value={evaluation.feedback}
                  onChange={(e) => setEvaluation({ ...evaluation, feedback: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEvaluatingTask(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Saving..." : "Submit Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW MENTEE DETAILS */}
      {viewingMentee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentee Profile</h3>
              <button
                onClick={() => setViewingMentee(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-base ${viewingMentee.avatarBg}`}>
                {getInitials(viewingMentee.name)}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">{viewingMentee.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{viewingMentee.email}</p>
              </div>
            </div>

            {(() => {
              const stats = menteeStatsMap[viewingMentee.id] || {
                taskCount: 0,
                completedCount: 0,
                progress: 0,
                currentTask: "No active task",
              };
              return (
                <div className="mt-6 space-y-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Joined On:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingMentee.joinedOn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Status:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{viewingMentee.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Completed Tasks:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {stats.completedCount} / {stats.taskCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Task Progress:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{stats.progress}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Current Task:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {stats.currentTask}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 flex items-center justify-between gap-2">
              <button
                onClick={() => setDeletingMentee(viewingMentee)}
                className="px-3.5 py-2 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Delete Mentee
              </button>
              <button
                onClick={() => setViewingMentee(null)}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE MENTEE (AND CASCADE TASKS) */}
      {deletingMentee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Mentee?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {deletingMentee.name}
                  </span>
                  ? All{" "}
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {menteeStatsMap[deletingMentee.id]?.taskCount || 0} task(s)
                  </span>{" "}
                  assigned to this mentee will also be permanently deleted.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingMentee(null)}
                disabled={actionLoading}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMentee}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                {actionLoading ? "Deleting..." : "Delete Mentee & Tasks"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorDashboard;
