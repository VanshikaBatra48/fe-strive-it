import AdminDashboard from "./AdminDashboard";
import MentorDashboard from "./MentorDashboard";
import MenteeDashboard from "./MenteeDashboard";

function Dashboards() {
  let user = null;
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      if (raw === "admin" || raw === "mentor" || raw === "mentee") {
        user = { role: raw };
      } else {
        const parsed = JSON.parse(raw);
        user = typeof parsed === "string" ? { role: parsed } : parsed;
      }
    }
  } catch {
    const raw = localStorage.getItem("user");
    if (raw) user = { role: raw };
  }

  // Default fallback if not set yet
  if (!user) {
    user = { role: "admin" };
    localStorage.setItem("user", JSON.stringify(user));
  }

  switch (user.role?.toLowerCase()) {
    case "admin":
      return <AdminDashboard />;

    case "mentor":
      return <MentorDashboard />;

    case "mentee":
      return <MenteeDashboard />;

    default:
      return <p className="p-8 text-center text-slate-500">Invalid user role.</p>;
  }
}

export default Dashboards;