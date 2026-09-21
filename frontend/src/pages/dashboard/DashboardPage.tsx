import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  TrendingUp, Package, Truck, Receipt, Users, AlertCircle,
  Clock, ArrowUpRight, DollarSign, ShoppingCart, Headphones, FileText,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency, cn } from "@/lib/utils";
import api from "@/lib/api";
import EmployeeDashboard from "./EmployeeDashboard";
import TodaysFollowUps from "@/components/TodaysFollowUps";

interface Stats {
  members: number; parties: number; invoices: number; orders: number;
  leads: number; tickets: number; products: number; tasks: number;
}
interface ChartPoint { month: string; revenue: number; orders: number; }
interface LeadStage  { status: string; count: number; value: number; }
interface ModuleStats {
  invoiceStats: Array<{ status: string; _count: { _all: number }; _sum: { total: number | null } }>;
  orderStats: Array<{ status: string; _count: { _all: number } }>;
  purchaseStats: Array<{ status: string; _count: { _all: number } }>;
  leadStats: Array<{ status: string; _count: { _all: number } }>;
}
interface FeedItem {
  type: string; id: string; title: string; subtitle: string; meta: string; createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  DRAFT:     { bg: "rgba(116,205,232,0.10)", color: "#74CDE8", dot: "#2E9CC4" },
  PENDING:   { bg: "rgba(245,158,11,0.1)",  color: "#FCD34D", dot: "#F59E0B" },
  CONFIRMED: { bg: "rgba(96,165,250,0.1)",  color: "#60A5FA", dot: "#3B82F6" },
  DISPATCHED:{ bg: "rgba(16,185,129,0.1)",  color: "#34D399", dot: "#10B981" },
  DELIVERED: { bg: "rgba(16,185,129,0.1)",  color: "#34D399", dot: "#10B981" },
  PAID:      { bg: "rgba(139,92,246,0.12)", color: "#C084FC", dot: "#8B5CF6" },
  CANCELLED: { bg: "rgba(239,68,68,0.08)",  color: "#F87171", dot: "#EF4444" },
  OPEN:      { bg: "rgba(116,205,232,0.10)", color: "#74CDE8", dot: "#2E9CC4" },
  RESOLVED:  { bg: "rgba(16,185,129,0.1)",  color: "#34D399", dot: "#10B981" },
  WON:       { bg: "rgba(16,185,129,0.1)",  color: "#34D399", dot: "#10B981" },
  LOST:      { bg: "rgba(239,68,68,0.08)",  color: "#F87171", dot: "#EF4444" },
  NEW:       { bg: "rgba(116,205,232,0.10)", color: "#74CDE8", dot: "#2E9CC4" },
  ADDED:     { bg: "rgba(116,205,232,0.12)", color: "#74CDE8", dot: "#2E9CC4" },
  INVOICE:   { bg: "rgba(16,185,129,0.1)",  color: "#34D399", dot: "#10B981" },
  ORDER:     { bg: "rgba(116,205,232,0.12)", color: "#74CDE8", dot: "#2E9CC4" },
  LEAD:      { bg: "rgba(245,158,11,0.1)",  color: "#FCD34D", dot: "#F59E0B" },
  TICKET:    { bg: "rgba(239,68,68,0.08)",  color: "#F87171", dot: "#EF4444" },
  PARTY:     { bg: "rgba(116,205,232,0.10)", color: "#74CDE8", dot: "#2E9CC4" },
};

const FEED_ICONS: Record<string, { icon: typeof DollarSign; color: string }> = {
  INVOICE: { icon: DollarSign,   color: "#10b981" },
  ORDER:   { icon: ShoppingCart, color: "#2e9cc4" },
  LEAD:    { icon: TrendingUp,   color: "#f59e0b" },
  TICKET:  { icon: Headphones,   color: "#ef4444" },
  PARTY:   { icon: Users,        color: "#74cde8" },
};

const card: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" };
const cardHeader: React.CSSProperties = { padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" };

export default function DashboardPage() {
  const { activeOrg, moduleAccess, employeeProfile } = useAuthStore();
  const isOrgAdmin = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currency = activeOrg?.currency || "INR";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  // Once employeeProfile loads, redirect role-specific users to their primary page
  const orgRole = employeeProfile?.orgRole;
  useEffect(() => {
    if (orgRole === "PROJECT_MANAGER") navigate("/pm-dashboard", { replace: true });
    else if (orgRole === "TEAM_LEAD") navigate("/team", { replace: true });
  }, [orgRole]);

  // All hooks must be declared before any early return
  const [stats, setStats] = useState<Stats | null>(null);
  const [moduleStats, setModuleStats] = useState<ModuleStats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [leadStages, setLeadStages] = useState<LeadStage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOrgAdmin) return;
    const load = async () => {
      setLoading(true);
      try {
        const [statsRes, activityRes, modStatsRes, chartRes] = await Promise.all([
          api.get("/org-admin/stats"),
          api.get("/org-admin/activity?limit=20"),
          api.get("/org-admin/module-stats"),
          api.get("/org-admin/charts"),
        ]);
        setStats(statsRes.data.data);
        setFeed(activityRes.data.data.feed || []);
        setModuleStats(modStatsRes.data.data);
        setChartData(chartRes.data.data?.chartData || []);
        setLeadStages(chartRes.data.data?.leadsByStage || []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [activeOrg?.id, isOrgAdmin]);

  // All non-admin users (STAFF, MANAGER, doctors, etc.) get the employee view
  if (!isOrgAdmin) {
    return <EmployeeDashboard />;
  }

  // Derived financials from module stats
  const totalRevenue = moduleStats?.invoiceStats
    ?.filter(s => ["PAID", "DELIVERED"].includes(s.status))
    ?.reduce((sum, s) => sum + (s._sum?.total || 0), 0) ?? 0;

  const pendingRevenue = moduleStats?.invoiceStats
    ?.filter(s => ["PENDING", "CONFIRMED", "DISPATCHED"].includes(s.status))
    ?.reduce((sum, s) => sum + (s._sum?.total || 0), 0) ?? 0;

  const openOrders = moduleStats?.orderStats
    ?.filter(s => !["DELIVERED", "CANCELLED"].includes(s.status))
    ?.reduce((sum, s) => sum + s._count._all, 0) ?? 0;

  const pendingPurchases = moduleStats?.purchaseStats
    ?.filter(s => !["RECEIVED", "CANCELLED"].includes(s.status))
    ?.reduce((sum, s) => sum + s._count._all, 0) ?? 0;

  // moduleAccess already equals enabledModules for OWNER/ADMIN — an isOrgAdmin
  // bypass here would show widgets for modules the org never enabled at all.
  const canSee = (key: string) => moduleAccess.includes(key);
  const bentoLayout = canSee("ACCOUNTS") && canSee("DISPATCH") && canSee("PURCHASE");

  return (
    <div className="page-pad" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div className="mesh-bg" style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 22px", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ position: "relative" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--text-primary)", margin: 0 }}>
            {t("dash_welcome")} <span aria-hidden>👋</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 4 }}>{today} · <span style={{ color: "var(--brand-color)", fontWeight: 600 }}>{activeOrg?.name}</span></p>
        </div>
        <span style={{ position: "relative", fontSize: 12, fontWeight: 600, color: "var(--text-sec)", background: "var(--bg-card)", border: "1px solid var(--border)", padding: "7px 14px", borderRadius: 8, flexShrink: 0 }}>
          {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>{t("dash_loading")}</div>
      ) : (
        <>
          <TodaysFollowUps />

          {/* KPI Row — financial (bento: revenue is the featured hero card) */}
          {(canSee("ACCOUNTS") || canSee("DISPATCH")) && (
            <div className={bentoLayout ? "bento-kpi" : undefined} style={bentoLayout ? undefined : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              {canSee("ACCOUNTS") && (
                <div className={cn("lift", bentoLayout && "bento-hero")} style={{
                  position: "relative", overflow: "hidden",
                  background: "linear-gradient(135deg, var(--brand-color), #1a6483 65%, #175671)",
                  borderRadius: 18, padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between",
                  minHeight: bentoLayout ? 168 : undefined, boxShadow: "0 14px 34px rgba(116,205,232,0.28)",
                }}>
                  <div className="grid-overlay" style={{ position: "absolute", inset: 0, opacity: 0.18 }} />
                  <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <TrendingUp size={21} color="#fff" />
                    </div>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.14)", padding: "3px 9px", borderRadius: 6, fontWeight: 700, letterSpacing: "0.04em" }}>PAID</span>
                  </div>
                  <div style={{ position: "relative" }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: "0 0 4px", fontWeight: 600 }}>{t("dash_total_revenue")}</p>
                    <p style={{ fontSize: bentoLayout ? 32 : 24, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>{formatCurrency(totalRevenue, currency)}</p>
                    {bentoLayout && chartData.length > 1 && (
                      <div style={{ marginTop: 10, height: 40 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                            <Line type="monotone" dataKey="revenue" stroke="#fff" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {canSee("ACCOUNTS") && (
                <div className={cn("lift", bentoLayout && "bento-b")} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239,68,68,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Receipt size={20} color="#F87171" />
                    </div>
                    <span style={{ fontSize: 10, color: "#f87171", background: "#ef444415", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>PENDING</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 4px", fontWeight: 500 }}>{t("dash_outstanding_dues")}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: "#F87171", margin: 0 }}>{formatCurrency(pendingRevenue, currency)}</p>
                </div>
              )}
              {canSee("DISPATCH") && (
                <div className={cn("lift", bentoLayout && "bento-c")} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Truck size={20} color="#FBBF24" />
                    </div>
                    <span style={{ fontSize: 10, color: "#FBBF24", background: "#f59e0b15", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>ACTIVE</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 4px", fontWeight: 500 }}>{t("dash_open_orders")}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: "#FBBF24", margin: 0 }}>{openOrders}</p>
                </div>
              )}
              {canSee("PURCHASE") && (
                <div className={cn("lift", bentoLayout && "bento-d")} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Package size={20} color="#C084FC" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 2px", fontWeight: 500 }}>{t("dash_pending_purchases")}</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: "#C084FC", margin: 0 }}>{pendingPurchases}</p>
                  </div>
                  <span style={{ fontSize: 10, color: "#C084FC", background: "#8b5cf615", padding: "3px 8px", borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>OPEN</span>
                </div>
              )}
            </div>
          )}

          {/* Mini stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {[
              { label: t("dash_team_members"),    value: stats?.members  ?? 0, icon: <Users size={18} />,       bg: "rgba(116,205,232,0.12)",  color: "#74CDE8", show: true },
              { label: t("dash_parties"),        value: stats?.parties  ?? 0, icon: <FileText size={18} />,    bg: "rgba(116,205,232,0.10)", color: "#74CDE8", show: canSee("CRM") },
              { label: t("dash_products"),       value: stats?.products ?? 0, icon: <Package size={18} />,    bg: "rgba(16,185,129,0.1)",   color: "#34D399", show: canSee("INVENTORY") },
              { label: t("dash_active_leads"),   value: stats?.leads    ?? 0, icon: <TrendingUp size={18} />, bg: "rgba(245,158,11,0.1)",   color: "#FBBF24", show: canSee("MARKETING") },
              { label: t("dash_open_tickets"),   value: stats?.tickets  ?? 0, icon: <Headphones size={18} />, bg: "rgba(239,68,68,0.08)",   color: "#F87171", show: canSee("SUPPORT") },
              { label: t("dash_active_tasks"),   value: stats?.tasks    ?? 0, icon: <Clock size={18} />,      bg: "rgba(139,92,246,0.12)",  color: "#C084FC", show: canSee("PROJECTS") },
            ].filter(s => s.show).map(s => (
              <div key={s.label} className="lift" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-faint)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          {((canSee("ACCOUNTS") && chartData.length > 0) || (canSee("MARKETING") && leadStages.length > 0)) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Revenue trend */}
              {canSee("ACCOUNTS") && chartData.length > 0 && (
              <div style={card}>
                <div style={cardHeader}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("dash_revenue_trend")}</p>
                    <p style={{ fontSize: 11, color: "var(--text-ghost)", margin: "3px 0 0" }}>{t("dash_revenue_subtitle")}</p>
                  </div>
                </div>
                <div style={{ padding: "16px 8px 12px" }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--text-ghost)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-ghost)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={42} />
                      <Tooltip
                        contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                        itemStyle={{ color: "#34D399" }}
                        formatter={(v: number) => [formatCurrency(v, currency), "Revenue"]}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#34D399" strokeWidth={2} dot={{ fill: "#34D399", r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              )}

              {/* Lead pipeline */}
              {canSee("MARKETING") && leadStages.length > 0 && (
              <div style={card}>
                <div style={cardHeader}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("dash_lead_pipeline")}</p>
                    <p style={{ fontSize: 11, color: "var(--text-ghost)", margin: "3px 0 0" }}>{t("dash_lead_subtitle")}</p>
                  </div>
                </div>
                <div style={{ padding: "16px 8px 12px" }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={leadStages} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="status" tick={{ fill: "var(--text-ghost)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-ghost)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                      <Tooltip
                        contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                        itemStyle={{ color: "#FBBF24" }}
                        formatter={(v: number) => [v, "Leads"]}
                      />
                      <Bar dataKey="count" fill="#2e9cc4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              )}
            </div>
          )}

          {/* Bottom section — Activity + Quick links */}
          <div className="dash-bottom">

            {/* Activity Feed */}
            <div style={card}>
              <div style={cardHeader}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("dash_recent_activity")}</p>
                  <p style={{ fontSize: 11, color: "var(--text-ghost)", margin: "3px 0 0" }}>{t("dash_activity_subtitle")}</p>
                </div>
                <button onClick={() => navigate("/admin")} style={{ background: "none", border: "none", color: "#74CDE8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  {t("label_view_all")} <ArrowUpRight size={13} />
                </button>
              </div>
              <div>
                {feed.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>
                    <AlertCircle size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
                    {t("dash_no_activity")}
                  </div>
                ) : feed.slice(0, 10).map((item, i) => {
                  const cfg = FEED_ICONS[item.type] || { icon: FileText, color: "#74cde8" };
                  const statusStyle = STATUS_COLORS[item.meta] || STATUS_COLORS[item.type] || { bg: "rgba(116,205,232,0.10)", color: "#74CDE8", dot: "#2E9CC4" };
                  return (
                    <div key={i} style={{ display: "flex", gap: 12, padding: "12px 20px", borderBottom: i < Math.min(feed.length, 10) - 1 ? "1px solid var(--bg-hover)" : "none", alignItems: "center" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: cfg.color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <cfg.icon size={15} color={cfg.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                        {item.subtitle && <div style={{ fontSize: 11, color: "var(--text-ghost)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtitle}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: statusStyle.bg, color: statusStyle.color, fontWeight: 600 }}>{item.meta}</span>
                        <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={card}>
                <div style={{ ...cardHeader, borderBottom: "none" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("dash_quick_actions")}</p>
                </div>
                <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: t("dash_action_add_party"),      href: "/crm",       color: "#74CDE8", show: canSee("CRM") },
                    { label: t("dash_action_sales_order"),   href: "/dispatch",  color: "#FBBF24", show: canSee("DISPATCH") },
                    { label: t("dash_action_new_invoice"),   href: "/accounts",  color: "#34D399", show: canSee("ACCOUNTS") },
                    { label: t("dash_action_add_product"),   href: "/inventory", color: "#C084FC", show: canSee("INVENTORY") },
                    { label: t("dash_action_purchase_order"),href: "/purchase",  color: "#F87171", show: canSee("PURCHASE") },
                    { label: t("dash_action_log_lead"),      href: "/marketing", color: "#60A5FA", show: canSee("MARKETING") },
                  ].filter(a => a.show).map(a => (
                    <button key={a.href} onClick={() => navigate(a.href)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${a.color}20`, background: a.color + "10", color: a.color, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" as const }}>
                      {a.label} →
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Stats Summary */}
              {moduleStats && (
                <div style={card}>
                  <div style={{ ...cardHeader, borderBottom: "none" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("dash_module_overview")}</p>
                  </div>
                  <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: t("dash_invoices"),  total: moduleStats.invoiceStats?.reduce((s, i) => s + i._count._all, 0) ?? 0,  color: "#34D399", show: canSee("ACCOUNTS") },
                      { label: t("dash_orders"),    total: moduleStats.orderStats?.reduce((s, i) => s + i._count._all, 0) ?? 0,    color: "#74CDE8", show: canSee("DISPATCH") },
                      { label: t("dash_purchases"), total: moduleStats.purchaseStats?.reduce((s, i) => s + i._count._all, 0) ?? 0, color: "#C084FC", show: canSee("PURCHASE") },
                      { label: t("dash_leads"),     total: moduleStats.leadStats?.reduce((s, i) => s + i._count._all, 0) ?? 0,     color: "#FBBF24", show: canSee("MARKETING") },
                    ].filter(m => m.show && m.total > 0).map(m => (
                      <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--bg-hover)" }}>
                        <span style={{ fontSize: 12, color: "var(--text-sec)" }}>{m.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
