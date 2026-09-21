import { useState, useEffect } from "react";
import { Outlet, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard, Users, Puzzle, Settings, ScrollText,
  LogOut, ChevronLeft, Shield, Menu, X, ClipboardCheck, KeyRound,
} from "lucide-react";

const navLinks = [
  { to: "/admin/dashboard", icon: LayoutDashboard,  label: "Dashboard" },
  { to: "/admin/team",      icon: Users,             label: "Team & Invites" },
  { to: "/admin/access",    icon: KeyRound,          label: "Module Access" },
  { to: "/admin/modules",   icon: Puzzle,            label: "Org Modules" },
  { to: "/admin/approvals", icon: ClipboardCheck,    label: "Approvals" },
  { to: "/admin/settings",  icon: Settings,          label: "Org Settings" },
  { to: "/admin/logs",      icon: ScrollText,        label: "Audit Logs" },
];

export default function AdminLayout() {
  const { isAuthenticated, activeOrg, logout } = useAuthStore();
  const navigate = useNavigate();
  const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;
  // Desktop: open by default; mobile: closed by default
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const isAdmin = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  // Close sidebar on mobile when window resizes, open on desktop
  useEffect(() => {
    const onResize = () => setSidebarOpen(!isMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const initials = activeOrg?.name
    ? activeOrg.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "AD";

  const mobile = isMobile();

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-main)", overflow: "hidden" }}>
      {/* Mobile overlay — dims the content when sidebar is open */}
      {mobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 39 }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div style={{
        width: 240,
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        // On mobile: absolutely positioned, slides in/out
        // On desktop: stays in flow, collapses to 0 width when closed
        ...(mobile ? {
          position: "fixed" as const,
          top: 0, bottom: 0,
          left: sidebarOpen ? 0 : -248,
          zIndex: 40,
          transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: sidebarOpen ? "8px 0 48px rgba(0,0,0,0.4)" : "none",
          height: "100vh",
        } : {
          // Desktop: animate width so content shifts smoothly
          width: sidebarOpen ? 240 : 0,
          overflow: "hidden",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          minWidth: 0,
        }),
      }}>
        {/* Inner wrapper keeps content at 240px so it doesn't reflow during animation */}
        <div style={{ width: 240, height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Brand / Org */}
          <div style={{ padding: "18px 16px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeOrg?.name ?? "Organization"}
                </div>
                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 600 }}>Admin Panel</div>
              </div>
            </div>

            {/* Admin badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "#6366f115", border: "1px solid #6366f130" }}>
              <Shield size={11} color="#818cf8" />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {activeOrg?.role ?? "Admin"} Access
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            {navLinks.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                onClick={() => mobile && setSidebarOpen(false)}
                style={({ isActive }) => ({
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                  color: isActive ? "var(--text-primary)" : "var(--text-ghost)",
                  background: isActive ? "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))" : "transparent",
                  borderLeft: isActive ? "2px solid #6366f1" : "2px solid transparent",
                  textDecoration: "none", fontSize: 13,
                  fontWeight: isActive ? 600 : 400, transition: "all 0.15s",
                  whiteSpace: "nowrap",
                })}>
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
            <NavLink to="/dashboard"
              onClick={() => mobile && setSidebarOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, color: "var(--text-ghost)", textDecoration: "none", fontSize: 12, marginBottom: 4, transition: "all 0.15s", whiteSpace: "nowrap" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-sec)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-ghost)")}>
              <ChevronLeft size={14} /> Back to App
            </NavLink>

            <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, textAlign: "left", whiteSpace: "nowrap" }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar — always visible, contains hamburger */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px",
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <button
            onClick={() => setSidebarOpen(p => !p)}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            style={{
              background: "none", border: "none",
              color: "#818cf8", cursor: "pointer",
              display: "flex", alignItems: "center",
              padding: 4, borderRadius: 6,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Admin Panel</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
