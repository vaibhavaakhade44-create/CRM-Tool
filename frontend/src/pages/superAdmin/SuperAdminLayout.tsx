import { useEffect, useState } from "react";
import { Outlet, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { LayoutDashboard, Building2, Users, LogOut, Shield, ChevronRight, Inbox, PackagePlus, Menu, X } from "lucide-react";

const navLinks = [
  { to: "/super-admin/dashboard",        icon: LayoutDashboard, label: "Dashboard" },
  { to: "/super-admin/organizations",    icon: Building2,       label: "Organizations" },
  { to: "/super-admin/users",            icon: Users,           label: "All Users" },
  { to: "/super-admin/module-requests",  icon: PackagePlus,     label: "Module Requests" },
  { to: "/super-admin/access-requests",  icon: Inbox,           label: "Access Requests" },
];

export default function SuperAdminLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;
  // Desktop: open by default; mobile: closed by default
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());

  // Close sidebar on mobile when window resizes, open on desktop
  useEffect(() => {
    const onResize = () => setSidebarOpen(!isMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isAuthenticated) return <Navigate to="/super-admin/login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const handleLogout = async () => { await logout(); navigate("/super-admin/login"); };

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

      {/* Sidebar */}
      <div style={{
        width: 240,
        background: "#050514",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        ...(mobile ? {
          position: "fixed" as const,
          top: 0, bottom: 0,
          left: sidebarOpen ? 0 : -248,
          zIndex: 40,
          transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: sidebarOpen ? "8px 0 48px rgba(0,0,0,0.4)" : "none",
          height: "100vh",
        } : {
          width: sidebarOpen ? 240 : 0,
          overflow: "hidden",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          minWidth: 0,
        }),
      }}>
        <div style={{ width: 240, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={16} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Super Admin</div>
                <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>Platform Control</div>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            {navLinks.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                onClick={() => mobile && setSidebarOpen(false)}
                style={({ isActive }) => ({
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                  color: isActive ? "var(--text-primary)" : "var(--text-ghost)", background: isActive ? "var(--border)" : "transparent",
                  textDecoration: "none", fontSize: 13, fontWeight: isActive ? 600 : 400, transition: "all 0.15s",
                  whiteSpace: "nowrap",
                })}>
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
            <NavLink to="/dashboard"
              onClick={() => mobile && setSidebarOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, color: "var(--text-ghost)", textDecoration: "none", fontSize: 12, marginBottom: 4, whiteSpace: "nowrap" }}>
              <ChevronRight size={14} /> Back to App
            </NavLink>
            <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, textAlign: "left", whiteSpace: "nowrap" }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
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
              color: "#ef4444", cursor: "pointer",
              display: "flex", alignItems: "center",
              padding: 4, borderRadius: 6,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Super Admin</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
