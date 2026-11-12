import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import useAuth from "../../hooks/useAuth";
import useUsers from "../../hooks/useUsers";

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

function AdminDashboard() {
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const { user: currentUser, logout } = useAuth();
  const {
    users,
    loading,
    error,
    createUser,
    updateUser,
    assignMentorToMentee,
    deleteUser,
    refetch,
  } = useUsers();

  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard", "mentors", "mentees"
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [notification, setNotification] = useState(null);



  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Search & filter states
  const [mentorSearch, setMentorSearch] = useState("");
  const [mentorFilter, setMentorFilter] = useState("All");

  const [menteeSearch, setMenteeSearch] = useState("");
  const [menteeFilter, setMenteeFilter] = useState("All");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState("mentor");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mentor: "",
    status: "Active",
    assignedMentees: [],
  });
  const [menteeDropdownOpen, setMenteeDropdownOpen] = useState(false);
  const [menteeSearchQuery, setMenteeSearchQuery] = useState("");
  const menteeDropdownRef = useRef(null);

  // Close mentee multi-select dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menteeDropdownRef.current &&
        !menteeDropdownRef.current.contains(event.target)
      ) {
        setMenteeDropdownOpen(false);
      }
    }
    if (menteeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menteeDropdownOpen]);

  // View, Edit & Assign Mentor Modal states
  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [assigningMentee, setAssigningMentee] = useState(null);
  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Filter mentors & mentees
  const mentors = useMemo(
    () => users.filter((u) => u.role === "mentor"),
    [users]
  );

  const availableMentors = useMemo(
    () => mentors.filter((m) => (m.status || "").toLowerCase() === "active"),
    [mentors]
  );

  const mentees = useMemo(
    () => users.filter((u) => u.role === "mentee"),
    [users]
  );

  const resolveMenteeMentor = (mentee) => {
    if (!mentee) return null;
    if (mentee.mentorId) {
      const byId = mentors.find((m) => m.id === mentee.mentorId);
      if (byId) return byId;
    }
    if (mentee.mentorDetails?.id) {
      return mentee.mentorDetails;
    }
    if (mentee.mentor) {
      return (
        mentors.find(
          (m) => m.name?.toLowerCase() === mentee.mentor.toLowerCase()
        ) || null
      );
    }
    return null;
  };

  // Search & Status filters for mentors
  const filteredMentors = useMemo(() => {
    return mentors.filter((m) => {
      const matchesSearch = `${m.name || ""} ${m.email || ""}`
        .toLowerCase()
        .includes(mentorSearch.toLowerCase());
      const matchesFilter =
        mentorFilter === "All" || (m.status || "").toLowerCase() === mentorFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [mentors, mentorSearch, mentorFilter]);

  // Search & Status filters for mentees
  const filteredMentees = useMemo(() => {
    return mentees.filter((m) => {
      const matchesSearch = `${m.name || ""} ${m.email || ""} ${m.mentor || ""}`
        .toLowerCase()
        .includes(menteeSearch.toLowerCase());
      const matchesFilter =
        menteeFilter === "All" || (m.status || "").toLowerCase() === menteeFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [mentees, menteeSearch, menteeFilter]);

  // Filtered and sorted mentees inside the assign-mentees dropdown (first unassigned, then assigned)
  const availableMenteesForAssign = useMemo(() => {
    let list = mentees;
    if (menteeSearchQuery.trim()) {
      const q = menteeSearchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aAssigned = Boolean(a.mentor && a.mentor.trim());
      const bAssigned = Boolean(b.mentor && b.mentor.trim());
      if (aAssigned !== bAssigned) {
        return aAssigned ? 1 : -1; // unassigned comes first
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [mentees, menteeSearchQuery]);

  const toggleMenteeSelection = (menteeId) => {
    setFormData((prev) => {
      const current = prev.assignedMentees || [];
      const exists = current.includes(menteeId);
      return {
        ...prev,
        assignedMentees: exists
          ? current.filter((id) => id !== menteeId)
          : [...current, menteeId],
      };
    });
  };

  const removeAssignedMentee = (menteeId) => {
    setFormData((prev) => ({
      ...prev,
      assignedMentees: (prev.assignedMentees || []).filter((id) => id !== menteeId),
    }));
  };

  const selectAllMentees = () => {
    setFormData((prev) => ({
      ...prev,
      assignedMentees: mentees.map((m) => m.id),
    }));
  };

  const clearAllAssignedMentees = () => {
    setFormData((prev) => ({
      ...prev,
      assignedMentees: [],
    }));
  };

  // Handlers
  function openCreate(role) {
    setCreateRole(role);
    setFormData({
      name: "",
      email: "",
      mentor: availableMentors[0]?.name || "",
      status: "Active",
      assignedMentees: [],
    });
    setMenteeDropdownOpen(false);
    setMenteeSearchQuery("");
    setModalError("");
    setShowCreateModal(true);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setModalError("Please provide name and email.");
      return;
    }

    const selectedCreateMentor =
      createRole === "mentee" && formData.mentor
        ? mentors.find(
            (m) => m.name?.toLowerCase() === formData.mentor.trim().toLowerCase()
          ) || null
        : null;

    setModalError("");
    setActionLoading(true);
    const res = await createUser({
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: createRole,
      status: formData.status || "Active",
      ...(createRole === "mentee"
        ? {
            mentor_id: selectedCreateMentor ? selectedCreateMentor.id : null,
            mentor: formData.mentor ? formData.mentor.trim() : null,
          }
        : { mentor: null }),
      assignedMentees: createRole === "mentor" ? (formData.assignedMentees || []) : [],
    });
    setActionLoading(false);

    if (res.success) {
      setShowCreateModal(false);
      setNotification({
        type: "success",
        message:
          res.message ||
          `${createRole === "mentor" ? "Mentor" : "Mentee"} created successfully!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setModalError(res.error || "Failed to create user");
    }
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault();
    if (!editingUser) return;
    const selectedEditMentor =
      editingUser.role === "mentee" && editingUser.mentor
        ? mentors.find(
            (m) => m.name?.toLowerCase() === editingUser.mentor.trim().toLowerCase()
          ) || null
        : null;

    setModalError("");
    setActionLoading(true);
    const res = await updateUser(editingUser.id, {
      name: editingUser.name,
      email: editingUser.email,
      status: editingUser.status,
      role: editingUser.role,
      ...(editingUser.role === "mentee"
        ? {
            mentor_id: selectedEditMentor ? selectedEditMentor.id : null,
            mentor: editingUser.mentor ? editingUser.mentor.trim() : null,
          }
        : { mentor: null }),
    });
    setActionLoading(false);

    if (res.success) {
      setEditingUser(null);
      setNotification({
        type: "success",
        message: "User updated successfully!",
      });
      setTimeout(() => setNotification(null), 3500);
    } else {
      setModalError(res.error || "Failed to update user");
    }
  }

  function openAssignMentorModal(mentee) {
    const currentMentor = resolveMenteeMentor(mentee);
    setAssigningMentee(mentee);
    setSelectedMentorId(currentMentor ? String(currentMentor.id) : "");
    setAssignError("");
  }

  async function handleAssignMentorSubmit(e) {
    e.preventDefault();
    if (!assigningMentee) return;

    if (!selectedMentorId) {
      setAssignError("Please select an available mentor.");
      return;
    }

    setAssignError("");
    setAssignLoading(true);
    const res = await assignMentorToMentee(assigningMentee.id, Number(selectedMentorId));
    setAssignLoading(false);

    if (res.success) {
      const assignedMentor = mentors.find((m) => m.id === Number(selectedMentorId));
      const targetName = assigningMentee.name;
      setAssigningMentee(null);
      setNotification({
        type: "success",
        message:
          res.message ||
          `Mentor ${assignedMentor?.name || ""} assigned to ${targetName} successfully!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setAssignError(res.error || "Failed to assign mentor.");
    }
  }

  async function handleRemoveMentorAssignment() {
    if (!assigningMentee) return;

    setAssignError("");
    setAssignLoading(true);
    const res = await assignMentorToMentee(assigningMentee.id, null);
    setAssignLoading(false);

    if (res.success) {
      const targetName = assigningMentee.name;
      setAssigningMentee(null);
      setNotification({
        type: "success",
        message:
          res.message ||
          `Mentor assignment removed from ${targetName} successfully!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setAssignError(res.error || "Failed to remove mentor assignment.");
    }
  }

  async function handleDelete(id, name) {
    const target = users.find((u) => u.id === Number(id));
    const warning =
      target?.role === "mentee"
        ? `Are you sure you want to delete ${name}? All tasks assigned to this mentee will also be permanently deleted.`
        : `Are you sure you want to delete ${name}?`;

    if (window.confirm(warning)) {
      setActionLoading(true);
      const res = await deleteUser(id);
      setActionLoading(false);
      if (res.success) {
        const extra =
          res.deletedTasksCount > 0
            ? ` (${res.deletedTasksCount} task${res.deletedTasksCount > 1 ? "s" : ""} removed)`
            : "";
        setNotification({
          type: "success",
          message: `${name} deleted successfully!${extra}`,
        });
        setTimeout(() => setNotification(null), 3500);
      } else {
        setNotification({
          type: "error",
          message: res.error || "Failed to delete user",
        });
        setTimeout(() => setNotification(null), 5000);
      }
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sidebar - Fixed size and viewport pinned */}
      <aside className="w-64 h-screen bg-[#111827] flex-shrink-0 flex flex-col justify-between border-r border-slate-800 z-30 select-none">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo & Brand */}
          <div className="p-6 pb-6 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center text-white">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-wide">
              TMS Admin
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 overflow-y-auto flex-1">
            <button
              onClick={() => {
                setActiveTab("dashboard");
                mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "dashboard"
                ? "bg-blue-600 text-white shadow-xs"
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
                setActiveTab("mentors");
                const el = document.getElementById("mentor-section");
                if (el && mainRef.current) {
                  const top = el.offsetTop - 20;
                  mainRef.current.scrollTo({ top, behavior: "smooth" });
                }
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "mentors"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Mentors</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("mentees");
                const el = document.getElementById("mentee-section");
                if (el && mainRef.current) {
                  const top = el.offsetTop - 20;
                  mainRef.current.scrollTo({ top, behavior: "smooth" });
                }
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === "mentees"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Mentees</span>
            </button>


          </nav>
        </div>

        {/* Sidebar Footer - ALWAYS VISIBLE */}
        <div className="p-4 border-t border-slate-800 bg-[#111827] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {getInitials(currentUser?.name || "Admin")}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser?.name || "Administrator"}</p>
              <p className="text-[11px] text-slate-400 truncate">{currentUser?.email || "admin@example.com"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Scrollable */}
      <main ref={mainRef} className="flex-1 h-screen overflow-y-auto px-8 py-6">

        {/* Top Navbar */}
        <div className="flex items-center justify-end gap-3 mb-4 relative">
          <ThemeToggle />

          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {getInitials(currentUser?.name || "Admin")}
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {currentUser?.name?.split(" ")[0] || "Admin"}
              </span>
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Profile Menu Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{currentUser?.name || "Administrator"}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentUser?.email || "admin@example.com"}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    Administrator
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
        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => refetch()} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer">Retry</button>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && users.length === 0 && (
          <div className="mb-5 p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="font-medium">Fetching users from backend...</span>
          </div>
        )}

        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage mentors and mentees in the Training Management System.
          </p>
        </div>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Total Mentors Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700/80 shadow-xs flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Total Mentors</p>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {mentors.length}
              </h2>
            </div>
          </div>

          {/* Total Mentees Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700/80 shadow-xs flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Mentees</p>
              <h2 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {mentees.length}
              </h2>
            </div>
          </div>
        </div>

        {/* Mentor List Section */}
        <section
          id="mentor-section"
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-8 overflow-hidden"
        >
          {/* Card Header */}
          <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentor List</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  View and manage all mentors in the system.
                </p>
              </div>
            </div>

            <button
              onClick={() => openCreate("mentor")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span>+</span>
              <span>Create Mentor</span>
            </button>
          </div>

          {/* Card Toolbar */}
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search mentors by name or email..."
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={mentorFilter}
                onChange={(e) => setMentorFilter(e.target.value)}
                className="w-28 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <button
                type="button"
                className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-700/80">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Joined On
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-48 min-w-[190px]">
                    Assigned Mentees
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                {filteredMentors.map((mentor) => (
                  <tr
                    key={mentor.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingUser(mentor);
                        }}
                        className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
                        title="Click to view mentor details"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-transform group-hover:scale-105 shadow-2xs ${mentor.avatarBg}`}
                        >
                          {getInitials(mentor.name)}
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:underline transition-colors">
                          {mentor.name}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {mentor.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30">
                        Mentor
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {mentor.joinedOn}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          mentor.status?.toLowerCase() === "inactive"
                            ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                            : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                        }`}
                      >
                        {mentor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-48 min-w-[190px]">
                      {(() => {
                        const assignedMentees = mentees.filter((m) =>
                          m.mentorId
                            ? m.mentorId === mentor.id
                            : m.mentor?.toLowerCase() === mentor.name.toLowerCase()
                        );
                        return (
                          <div className="w-48">
                            <select
                              value=""
                              disabled={assignedMentees.length === 0}
                              className={`w-full truncate border rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                                assignedMentees.length === 0
                                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer shadow-2xs"
                              }`}
                              onChange={(e) => {
                                const selected = assignedMentees.find(
                                  (m) => m.id.toString() === e.target.value
                                );
                                if (selected) {
                                  setViewingUser(selected);
                                }
                              }}
                            >
                              <option value="" disabled>
                                {assignedMentees.length === 0
                                  ? "No mentees assigned"
                                  : `${assignedMentees.length} Mentee${assignedMentees.length > 1 ? "s" : ""} Assigned`}
                              </option>
                              {assignedMentees.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* View Button */}
                        <button
                          onClick={() => {
                            setViewingUser(mentor);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingUser({ ...mentor })}
                          className="border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <span>Edit</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(mentor.id, mentor.name)}
                          className="border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 dark:text-rose-300 px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredMentors.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400 dark:text-slate-400 text-sm">
                      No mentors found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Mentee List Section */}
        <section
          id="mentee-section"
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-8 overflow-hidden"
        >
          {/* Card Header */}
          <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Mentee List</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  View and manage all mentees in the system.
                </p>
              </div>
            </div>

            <button
              onClick={() => openCreate("mentee")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span>+</span>
              <span>Create Mentee</span>
            </button>
          </div>

          {/* Card Toolbar */}
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search mentees by name or email..."
                value={menteeSearch}
                onChange={(e) => setMenteeSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={menteeFilter}
                onChange={(e) => setMenteeFilter(e.target.value)}
                className="w-28 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <button
                type="button"
                className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-700/80">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Assigned Mentor
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Joined On
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                {filteredMentees.map((mentee) => {
                  const assignedMentor = resolveMenteeMentor(mentee);
                  return (
                  <tr
                    key={mentee.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingUser(mentee);
                        }}
                        className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
                        title="Click to view mentee details"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-transform group-hover:scale-105 shadow-2xs ${mentee.avatarBg}`}
                        >
                          {getInitials(mentee.name)}
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:underline transition-colors">
                          {mentee.name}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {mentee.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30">
                        Mentee
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-200 font-medium">
                      {assignedMentor ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>{assignedMentor.name}</span>
                          {assignedMentor.status?.toLowerCase() === "inactive" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border border-amber-200/70 dark:border-amber-700/50">
                              Inactive
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                          Not Assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {mentee.joinedOn}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          mentee.status?.toLowerCase() === "inactive"
                            ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                            : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                        }`}
                      >
                        {mentee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Assign / Change Mentor Button */}
                        <button
                          type="button"
                          onClick={() => openAssignMentorModal(mentee)}
                          className="border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={assignedMentor ? "Change or remove assigned mentor" : "Assign mentor"}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          <span>{assignedMentor ? "Change Mentor" : "Assign Mentor"}</span>
                        </button>

                        {/* View Button */}
                        <button
                          onClick={() => {
                            setViewingUser(mentee);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingUser({ ...mentee })}
                          className="border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <span>Edit</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(mentee.id, mentee.name)}
                          className="border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 dark:text-rose-300 px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}

                {filteredMentees.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400 dark:text-slate-400 text-sm">
                      No mentees found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create New {createRole === "mentor" ? "Mentor" : "Mentee"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter the user details below.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter name... "
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                A temporary password is generated automatically and emailed to the user upon creation.
              </div>

              {createRole === "mentee" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Assign Mentor
                  </label>
                  <select
                    value={formData.mentor || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, mentor: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Unassigned (No Mentor)</option>
                    {availableMentors.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assign Mentees (Multi-Select Dropdown) - ONLY for creating new Mentor */}
              {createRole === "mentor" && (
                <div ref={menteeDropdownRef} className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Assign Mentees
                    </label>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {formData.assignedMentees?.length || 0} selected
                    </span>
                  </div>

                  {/* Dropdown trigger button */}
                  <button
                    type="button"
                    onClick={() => setMenteeDropdownOpen((prev) => !prev)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-left bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span
                      className={
                        formData.assignedMentees?.length > 0
                          ? "text-slate-800 dark:text-white font-medium"
                          : "text-slate-400 dark:text-slate-500"
                      }
                    >
                      {formData.assignedMentees?.length > 0
                        ? `${formData.assignedMentees.length} mentee${formData.assignedMentees.length > 1 ? "s" : ""} selected`
                        : "Select mentees to assign..."}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        menteeDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Selected Mentees Pills/Chips */}
                  {formData.assignedMentees?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                      {formData.assignedMentees.map((menteeId) => {
                        const m = mentees.find((item) => item.id === menteeId);
                        if (!m) return null;
                        return (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-500/30 shadow-2xs"
                          >
                            <span>{m.name}</span>
                            <button
                              type="button"
                              onClick={() => removeAssignedMentee(m.id)}
                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 ml-0.5 cursor-pointer focus:outline-none"
                              title="Remove mentee"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown Menu */}
                  {menteeDropdownOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      {/* Search box & Quick actions */}
                      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                        <div className="relative">
                          <svg
                            className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Search mentee by name or email..."
                            value={menteeSearchQuery}
                            onChange={(e) => setMenteeSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                        </div>

                        {mentees.length > 0 && (
                          <div className="flex items-center justify-between text-xs px-0.5">
                            <span className="text-slate-500 dark:text-slate-400">
                              {formData.assignedMentees?.length || 0} of {mentees.length} selected
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={selectAllMentees}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                              >
                                Select All
                              </button>
                              <span className="text-slate-300 dark:text-slate-600">|</span>
                              <button
                                type="button"
                                onClick={clearAllAssignedMentees}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mentee List */}
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {mentees.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            No mentees registered in the system yet.
                          </div>
                        ) : availableMenteesForAssign.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            No mentees matching &quot;{menteeSearchQuery}&quot;
                          </div>
                        ) : (
                          availableMenteesForAssign.map((m, idx) => {
                            const isSelected = (formData.assignedMentees || []).includes(m.id);
                            const isAssigned = Boolean(m.mentor?.trim());
                            const prevWasUnassigned =
                              idx > 0 &&
                              !availableMenteesForAssign[idx - 1].mentor?.trim();
                            const showAssignedHeader = isAssigned && (idx === 0 || prevWasUnassigned);
                            const showUnassignedHeader = !isAssigned && idx === 0;

                            return (
                              <div key={m.id}>
                                {showUnassignedHeader && (
                                  <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                                    <span>Unassigned Mentees</span>
                                    <span className="text-[10px] lowercase font-normal opacity-80">(Available)</span>
                                  </div>
                                )}
                                {showAssignedHeader && (
                                  <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60">
                                    Currently Assigned Mentees
                                  </div>
                                )}
                                <label
                                  className={`w-full px-3 py-2.5 flex items-center gap-3 cursor-pointer select-none transition-colors ${
                                    isSelected
                                      ? "bg-blue-50/70 dark:bg-blue-900/20"
                                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleMenteeSelection(m.id)}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:bg-slate-800 cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                        {m.name}
                                      </p>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                          m.mentor
                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                            : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        }`}
                                      >
                                        {m.mentor ? `Mentor: ${m.mentor}` : "Unassigned"}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {m.email}
                                    </p>
                                  </div>
                                </label>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status || "Active"}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create {createRole === "mentor" ? "Mentor" : "Mentee"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden text-slate-800 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">User Details</h3>
              <button
                onClick={() => setViewingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${viewingUser.avatarBg}`}
                >
                  {getInitials(viewingUser.name)}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    {viewingUser.name}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{viewingUser.email}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 space-y-3 text-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Role:</span>
                  <span
                    className={`font-semibold capitalize px-2.5 py-0.5 rounded-full text-xs ${viewingUser.role === "mentor"
                      ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      }`}
                  >
                    {viewingUser.role}
                  </span>
                </div>
                {viewingUser.role === "mentee" && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Assigned Mentor:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {resolveMenteeMentor(viewingUser)?.name || "Not Assigned"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status:</span>
                  <span
                    className={`font-semibold capitalize px-2.5 py-0.5 rounded-full text-xs ${
                      viewingUser.status?.toLowerCase() === "inactive"
                        ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                        : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {viewingUser.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Joined Date:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewingUser.joinedOn}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setViewingUser(null)}
                  className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden text-slate-800 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit {editingUser.role === "mentor" ? "Mentor" : "Mentee"}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {editingUser.role === "mentee" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Assigned Mentor
                  </label>
                  <select
                    value={editingUser.mentor || ""}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, mentor: e.target.value || "" }))
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Unassigned (No Mentor)</option>
                    {availableMentors.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                    {editingUser.mentor &&
                      !availableMentors.some(
                        (m) => m.name?.toLowerCase() === editingUser.mentor?.toLowerCase()
                      ) && (
                        <option value={editingUser.mentor}>
                          {editingUser.mentor} (Inactive)
                        </option>
                      )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={editingUser.status}
                  onChange={(e) =>
                    setEditingUser((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN MENTOR MODAL */}
      {assigningMentee && (() => {
        const currentMentor = resolveMenteeMentor(assigningMentee);
        const isUnchangedSelection =
          Boolean(currentMentor) && Number(selectedMentorId) === currentMentor.id;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden text-slate-800 dark:text-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {currentMentor ? "Change Assigned Mentor" : "Assign Mentor"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select an available mentor for this mentee.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={assignLoading}
                  onClick={() => setAssigningMentee(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50 text-xl font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleAssignMentorSubmit} className="p-6 space-y-4">
                {assignError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{assignError}</span>
                  </div>
                )}

                {/* Mentee Summary */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${assigningMentee.avatarBg}`}
                    >
                      {getInitials(assigningMentee.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {assigningMentee.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {assigningMentee.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Current Mentor:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {currentMentor ? currentMentor.name : "Not Assigned"}
                    </span>
                  </div>
                </div>

                {/* No available mentors warning */}
                {availableMentors.length === 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-medium">
                    No active mentors are available. Create or activate a mentor before assigning.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Select Mentor
                  </label>
                  <select
                    value={selectedMentorId}
                    onChange={(e) => {
                      setSelectedMentorId(e.target.value);
                      if (assignError) setAssignError("");
                    }}
                    disabled={assignLoading || availableMentors.length === 0}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">-- Choose an available mentor --</option>
                    {currentMentor &&
                      !availableMentors.some((m) => m.id === currentMentor.id) && (
                        <option value={String(currentMentor.id)} disabled>
                          {currentMentor.name} (Inactive - current)
                        </option>
                      )}
                    {availableMentors.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {currentMentor && (
                      <button
                        type="button"
                        disabled={assignLoading}
                        onClick={handleRemoveMentorAssignment}
                        className="px-3.5 py-2 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Remove Mentor
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={assignLoading}
                      onClick={() => setAssigningMentee(null)}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        assignLoading ||
                        availableMentors.length === 0 ||
                        !selectedMentorId ||
                        isUnchangedSelection
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                    >
                      {assignLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>
                          {currentMentor ? "Confirm Change" : "Confirm Assignment"}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default AdminDashboard;
