import { Bell, LogOut, User, ChevronDown, AlertCircle, AlertTriangle, Info, X, Menu, Search, Users, TrendingUp, Briefcase, Receipt, Package, Sun, Moon, CheckCircle, HeartPulse, BellRing, Plus, ShieldCheck, Check } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import api from "@/lib/api";
import { getInitials } from "@/lib/utils";
import { isPushSupported, isPushSubscribed, enablePushNotifications } from "@/lib/pushNotifications";
import { WBA_CATEGORIES } from "@/pages/wba/WBAPage";
import { LeadFormModal } from "@/pages/leads/LeadsPage";
import { LeadModal as CarLeadModal } from "@/pages/cars/CarsPage";

interface Alert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  subtitle: string;
  link: string;
  createdAt: string | null;
}

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

const SEV_ICON = {
  critical: <AlertCircle size={14} color="#ef4444" />,
  warning: <AlertTriangle size={14} color="#f59e0b" />,
  info: <Info size={14} color="#2e9cc4" />,
};
const SEV_DOT = { critical: "#ef4444", warning: "#f59e0b", info: "#2e9cc4" };

interface SearchResults { parties?: any[]; leads?: any[]; deals?: any[]; invoices?: any[]; products?: any[]; patients?: any[]; }

const RESULT_ICONS: Record<string, React.ReactNode> = {
  parties: <Users size={12} />, leads: <TrendingUp size={12} />, deals: <Briefcase size={12} />,
  invoices: <Receipt size={12} />, products: <Package size={12} />, patients: <HeartPulse size={12} />,
};
const RESULT_COLORS: Record<string, string> = {
  parties: "#74CDE8", leads: "#f59e0b", deals: "#10b981", invoices: "#F87171", products: "#60a5fa", patients: "#ef4444",
};

function getItemDisplay(category: string, item: any): { label: string; sub?: string; href: string } {
  switch (category) {
    case "parties":  return { label: item.name, sub: [item.type, item.email].filter(Boolean).join(" · "), href: `/crm/${item.id}` };
    case "leads":    return { label: item.name, sub: item.company || item.status, href: "/marketing" };
    case "deals":    return { label: item.title, sub: item.party?.name || item.stage, href: "/deals" };
    case "invoices": return { label: item.invoiceNumber, sub: item.party?.name, href: "/accounts" };
    case "products": return { label: item.name, sub: item.sku ? `SKU: ${item.sku}` : undefined, href: "/inventory" };
    case "patients": return { label: item.name, sub: [item.patientCode, item.phone].filter(Boolean).join(" · "), href: `/health?patientId=${item.id}` };
    default:         return { label: item.name || item.id, href: "/dashboard" };
  }
}

interface HeaderProps { onMenuToggle?: () => void; }

export default function Header({ onMenuToggle }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, activeOrg } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showQuickLead, setShowQuickLead] = useState(false);
  const [showQuickCarLead, setShowQuickCarLead] = useState(false);
  const [showQuickProject, setShowQuickProject] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null); // null = unknown/checking
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (bellOpen && isPushSupported() && pushEnabled === null) {
      isPushSubscribed().then(setPushEnabled);
    }
  }, [bellOpen, pushEnabled]);

  const handleEnablePush = async () => {
    setPushBusy(true);
    const result = await enablePushNotifications();
    setPushEnabled(result.ok);
    setPushBusy(false);
  };
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults(null); return; }
    setSearchLoading(true);
    try {
      const r = await api.get("/search", { params: { q } });
      setSearchResults(r.data.data);
    } catch { setSearchResults(null); }
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery) { setSearchResults(null); setSearchLoading(false); return; }
    searchTimer.current = setTimeout(() => doSearch(searchQuery), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, doSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadAlerts = async () => {
    if (!activeOrg) return;
    setAlertLoading(true);
    try {
      const [alertRes, notifRes] = await Promise.allSettled([
        api.get("/org-admin/alerts"),
        api.get("/notifications"),
      ]);
      const fetchedAlerts = alertRes.status === "fulfilled" ? (alertRes.value.data.data?.alerts || []) : [];
      const fetchedNotifs: AppNotification[] = notifRes.status === "fulfilled" ? (notifRes.value.data.data?.notifications || []) : [];
      setAlerts(fetchedAlerts);
      setNotifications(fetchedNotifs);
      setUnreadCount(fetchedNotifs.filter(n => !n.isRead).length);
    } catch { setAlerts([]); }
    setAlertLoading(false);
  };

  // Load alerts on mount + when org changes
  useEffect(() => { loadAlerts(); }, [activeOrg?.id]);

  // Reload when bell opens
  const toggleBell = () => {
    if (!bellOpen) loadAlerts();
    setBellOpen(p => !p);
    setMenuOpen(false);
  };

  // Close bell on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close quick-add on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setQuickAddOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasWBA = activeOrg?.enabledModules?.includes("WBA");
  // On the Cars page, "quick add lead" should create a car buyer lead, not a
  // CRM/Marketing one — they're different entities with different fields.
  const onCarsPage = location.pathname.startsWith("/cars");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const totalCount = alerts.length + unreadCount;

  const hasResults = searchResults && Object.values(searchResults).some(arr => arr && arr.length > 0);

  return (
    <>
    <header style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
      className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2.5">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="mobile-menu-btn w-9 h-9 rounded-lg items-center justify-center transition-colors cursor-pointer"
          style={{ display: "none", color: "var(--text-faint)" }}
        >
          <Menu style={{ width: 20, height: 20 }} />
        </button>
        <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: "var(--text-faint)" }}>{activeOrg?.name}</span>
        {activeOrg && (
          <span className="text-[11px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
            {activeOrg.currency}
          </span>
        )}
      </div>

      {/* Global Search — hidden on mobile via CSS class */}
      <div ref={searchRef} className="header-search" style={{ position: "relative", flex: 1, maxWidth: 380, margin: "0 12px" }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)", pointerEvents: "none" }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search parties, deals, products, patients..."
          style={{
            width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 8,
            padding: "7px 12px 7px 32px", color: "var(--text-primary)", fontSize: 13, outline: "none",
            boxSizing: "border-box", transition: "border-color 0.15s",
          }}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 2 }}>
            <X size={13} />
          </button>
        )}

        {/* Dropdown */}
        {searchOpen && searchQuery.length >= 2 && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
            boxShadow: "0 20px 60px var(--shadow)", zIndex: 200, overflow: "hidden", maxHeight: 420, overflowY: "auto",
          }}>
            {searchLoading ? (
              <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>Searching...</div>
            ) : !hasResults ? (
              <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>No results for "{searchQuery}"</div>
            ) : (
              Object.entries(searchResults || {}).map(([category, items]) => {
                if (!items || items.length === 0) return null;
                const color = RESULT_COLORS[category] || "#74CDE8";
                const icon = RESULT_ICONS[category];
                return (
                  <div key={category}>
                    <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color }}>{icon}</span>
                      {category}
                    </div>
                    {items.map((item: any) => {
                      const display = getItemDisplay(category, item);
                      return (
                        <div
                          key={item.id}
                          onClick={() => { navigate(display.href); setSearchOpen(false); setSearchQuery(""); }}
                          style={{ padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{display.label}</div>
                            {display.sub && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{display.sub}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Quick add — Lead / Project, available from any dashboard */}
        <div ref={quickAddRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setQuickAddOpen(p => !p); setBellOpen(false); setMenuOpen(false); }}
            title="Quick add"
            className="flex items-center gap-1.5 rounded-lg cursor-pointer"
            style={{ height: 34, padding: "0 11px", color: "#06231f", background: "#2FB8A6", border: "none", fontSize: 12.5, fontWeight: 700 }}
          >
            <Plus size={15} /> <span className="hidden sm:inline">Add</span>
          </button>

          {quickAddOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)", width: 200,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
              boxShadow: "0 20px 60px var(--shadow)", zIndex: 100, overflow: "hidden", padding: 6,
            }}>
              <button
                onClick={() => { onCarsPage ? setShowQuickCarLead(true) : setShowQuickLead(true); setQuickAddOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors cursor-pointer"
                style={{ color: "var(--text-sec)", background: "transparent", border: "none", textAlign: "left" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sec)"; }}
              >
                <TrendingUp size={15} color="#f59e0b" /> {onCarsPage ? "New Car Lead" : "New Lead"}
              </button>
              {hasWBA && (
                <button
                  onClick={() => { setShowQuickProject(true); setQuickAddOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors cursor-pointer"
                  style={{ color: "var(--text-sec)", background: "transparent", border: "none", textAlign: "left" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sec)"; }}
                >
                  <ShieldCheck size={15} color="#2FB8A6" /> New Project
                </button>
              )}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          style={{ color: "var(--text-ghost)", background: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-ghost)"; }}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Bell */}
        <div ref={bellRef} style={{ position: "relative" }}>
          <button
            onClick={toggleBell}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative cursor-pointer"
            style={{ color: "var(--text-ghost)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-ghost)"; }}
          >
            <Bell style={{ width: 18, height: 18 }} />
            {totalCount > 0 && (
              <span style={{
                position: "absolute", top: 5, right: 5,
                width: criticalCount > 0 ? "auto" : 8, minWidth: 8, height: 8,
                background: criticalCount > 0 ? "#ef4444" : "var(--brand-color)",
                borderRadius: 99, border: "1px solid var(--bg-card)",
                fontSize: 9, fontWeight: 700, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: criticalCount > 0 ? "0 3px" : 0, lineHeight: 1,
              }}>
                {criticalCount > 0 ? criticalCount : ""}
              </span>
            )}
          </button>

          {/* Bell Dropdown */}
          {bellOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)", width: 360,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14,
              boxShadow: "0 24px 80px var(--shadow)", zIndex: 100, overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Notifications</span>
                  {totalCount > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: "rgba(116,205,232,0.12)", color: "#74CDE8", padding: "1px 7px", borderRadius: 99 }}>
                      {totalCount}
                    </span>
                  )}
                </div>
                <button onClick={() => setBellOpen(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 4 }}>
                  <X size={15} />
                </button>
              </div>

              {/* Enable browser push — only shown when supported and not yet enabled */}
              {isPushSupported() && pushEnabled === false && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "rgba(116,205,232,0.05)" }}>
                  <BellRing size={14} color="#74CDE8" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--text-sec)", flex: 1 }}>Get desktop alerts for due follow-ups</span>
                  <button
                    onClick={handleEnablePush}
                    disabled={pushBusy}
                    style={{ background: "#74CDE8", border: "none", borderRadius: 6, padding: "5px 10px", color: "#0a1a1f", fontSize: 11, fontWeight: 700, cursor: pushBusy ? "default" : "pointer", opacity: pushBusy ? 0.7 : 1, flexShrink: 0 }}
                  >
                    {pushBusy ? "Enabling…" : "Enable"}
                  </button>
                </div>
              )}

              {/* Alert + Notification List */}
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {alertLoading ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>Loading...</div>
                ) : alerts.length === 0 && notifications.length === 0 ? (
                  <div style={{ padding: "40px 16px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><CheckCircle size={32} color="#10b981" /></div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sec)", margin: 0 }}>All clear!</p>
                    <p style={{ fontSize: 12, color: "var(--text-ghost)", marginTop: 4 }}>No pending alerts or notifications.</p>
                  </div>
                ) : (
                  <>
                    {alerts.map((a, i) => (
                      <div
                        key={a.id + i}
                        onClick={() => { navigate(a.link); setBellOpen(false); }}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "12px 16px", cursor: "pointer",
                          borderBottom: "1px solid var(--border)", transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ marginTop: 2, flexShrink: 0 }}>{SEV_ICON[a.severity]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{a.subtitle}</div>
                        </div>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: SEV_DOT[a.severity], flexShrink: 0, marginTop: 5 }} />
                      </div>
                    ))}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.isRead) {
                            await api.patch("/notifications/mark-read", { ids: [n.id] }).catch(() => {});
                            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
                            setUnreadCount(c => Math.max(0, c - 1));
                          }
                          if (n.link) navigate(n.link);
                          setBellOpen(false);
                        }}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "12px 16px", cursor: "pointer",
                          borderBottom: "1px solid var(--border)", transition: "background 0.15s",
                          background: n.isRead ? "transparent" : "rgba(116,205,232,0.05)",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = n.isRead ? "transparent" : "rgba(116,205,232,0.05)")}
                      >
                        <div style={{ marginTop: 2, flexShrink: 0 }}><Info size={14} color="var(--brand-color)" /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: n.isRead ? 400 : 600, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{n.message}</div>
                        </div>
                        {!n.isRead && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-color)", flexShrink: 0, marginTop: 5 }} />}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              {(alerts.length > 0 || notifications.length > 0) && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        await api.patch("/notifications/mark-read", { ids: notifications.filter(n => !n.isRead).map(n => n.id) }).catch(() => {});
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                        setUnreadCount(0);
                      }}
                      style={{ flex: 1, background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", color: "#74CDE8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => { navigate("/admin/dashboard"); setBellOpen(false); }}
                    style={{ flex: 1, background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", color: "#74CDE8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    View Admin →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => { setMenuOpen(!menuOpen); setBellOpen(false); }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ background: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--brand-color), #74cde8)" }}>
              {user ? getInitials(user.name) : "U"}
            </div>
            <span className="text-sm font-medium" style={{ color: "var(--text-sec)" }}>{user?.name?.split(" ")[0]}</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-ghost)" }} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-2xl z-50 py-1 border"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "0 20px 60px var(--shadow)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{user?.name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-ghost)" }}>{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate("/settings"); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                >
                  <User className="w-4 h-4" />
                  Settings
                </button>
                <div style={{ borderTop: "1px solid var(--border)" }} className="mt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    {showQuickLead && <QuickAddLeadWrapper onClose={() => setShowQuickLead(false)} />}
    {showQuickCarLead && <CarLeadModal lead={null} onClose={() => setShowQuickCarLead(false)} onSaved={() => {}} />}
    {showQuickProject && <QuickAddProjectModal onClose={() => setShowQuickProject(false)} />}
    </>
  );
}

// ── Quick-add modals ─────────────────────────────────────────────
// Deliberately self-contained (not "navigate to the full module page") —
// every org member can log a lead or start a project from anywhere, even
// if their job role doesn't grant them the full Leads/WBA module.
const qaModal: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const qaBox: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto" };
const qaInput: React.CSSProperties = { width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 11px", color: "var(--text-primary)", fontSize: 13.5, outline: "none", boxSizing: "border-box" };
const qaLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--text-sec)", fontWeight: 600 };

// Same exact form as the Leads page's own "Add Lead" — not a stripped-down
// alternate version — so it looks and works identically for every role,
// wherever it's opened from. Only fetches its own employee list here since
// this isn't nested under the Leads page.
function QuickAddLeadWrapper({ onClose }: { onClose: () => void }) {
  const [employees, setEmployees] = useState<{ id: string; name: string; designation?: string }[]>([]);

  useEffect(() => {
    api.get("/organizations/current/directory").then(r => setEmployees(r.data.data ?? [])).catch(() => {});
  }, []);

  return <LeadFormModal employees={employees} onClose={onClose} onSaved={() => {}} />;
}

function QuickAddProjectModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ projectName: "", clientName: "", category: "VAPT", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!form.projectName.trim() || !form.clientName.trim()) { setError("Project name and client name are required."); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/wba/projects/quick", form);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not add the project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={qaModal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={qaBox}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Project</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        {done ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <Check size={28} color="#10b981" style={{ margin: "0 auto 8px", display: "block" }} />
            <p style={{ color: "#10b981", fontWeight: 600, margin: 0 }}>Project added — your Project Manager will staff it.</p>
          </div>
        ) : (
          <>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {error && <div style={{ background: "#450a0a", color: "#f87171", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}
              <label style={qaLabel}>Project Name<input style={qaInput} value={form.projectName} onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} placeholder="e.g. Acme Corp — VAPT Engagement" autoFocus /></label>
              <label style={qaLabel}>Client Name<input style={qaInput} value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} /></label>
              <label style={qaLabel}>Category
                <select style={qaInput} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {Object.entries(WBA_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label style={qaLabel}>Description<textarea style={{ ...qaInput, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></label>
            </div>
            <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-sec)", cursor: "pointer", fontSize: 13.5 }}>Cancel</button>
              <button onClick={submit} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#2FB8A6", color: "#06231f", fontWeight: 700, cursor: saving ? "default" : "pointer", fontSize: 13.5, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Adding..." : "Add Project"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
