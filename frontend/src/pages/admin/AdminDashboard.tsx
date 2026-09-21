import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from 'react-i18next';
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Headphones, Package,
  FileText, Activity, BarChart3, Calendar, Check, X, Clock,
} from "lucide-react";

const S = {
  page: { padding: "28px 32px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  hdr: { marginBottom: 28 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub: { fontSize: 13, color: "var(--text-ghost)", marginTop: 4 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  tag: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 } as React.CSSProperties,
  btnGreen: { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4 } as React.CSSProperties,
  btnRed:   { background: "rgba(239,68,68,0.1)",  border: "1px solid rgba(239,68,68,0.2)",  color: "#ef4444", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4 } as React.CSSProperties,
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:"#818cf8",PENDING:"#f59e0b",CONFIRMED:"#60a5fa",DISPATCHED:"#a78bfa",
  DELIVERED:"#10b981",CANCELLED:"#ef4444",OPEN:"#818cf8",RESOLVED:"#10b981",
  WON:"#10b981",LOST:"#ef4444",NEW:"#818cf8",ADDED:"#6366f1",APPROVED:"#10b981",PAID:"#10b981",SENT:"#60a5fa",
};

const FEED_ICONS: Record<string, { icon: typeof DollarSign; color: string }> = {
  INVOICE: { icon: DollarSign, color: "#10b981" },
  ORDER:   { icon: ShoppingCart, color: "#6366f1" },
  LEAD:    { icon: TrendingUp, color: "#f59e0b" },
  TICKET:  { icon: Headphones, color: "#ef4444" },
  PARTY:   { icon: Users, color: "#818cf8" },
};

interface Stats { members:number; parties:number; invoices:number; orders:number; leads:number; tickets:number; products:number; tasks:number; }
interface FeedItem { type:string; id:string; title:string; subtitle:string; meta:string; createdAt:string; }
interface LeaveReq { id:string; leaveType:string; fromDate:string; toDate:string; days:number; reason?:string; status:string; createdAt:string; employee:{ id:string; name:string; employeeCode:string; designation?:string; department?:string }; }

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [feed,    setFeed]    = useState<FeedItem[]>([]);
  const [leaves,  setLeaves]  = useState<LeaveReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [leaveFilter, setLeaveFilter] = useState("PENDING");

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, fRes, lRes] = await Promise.allSettled([
      api.get("/org-admin/stats"),
      api.get("/org-admin/activity?limit=50"),
      api.get("/org-admin/leaves?status=PENDING"),
    ]);
    if (sRes.status === "fulfilled") setStats(sRes.value.data.data);
    if (fRes.status === "fulfilled") setFeed(fRes.value.data.data.feed || []);
    if (lRes.status === "fulfilled") setLeaves(lRes.value.data.data || []);
    setLoading(false);
  }, [activeOrg?.id]);

  const loadLeaves = useCallback(async (status: string) => {
    try {
      const r = await api.get(`/org-admin/leaves?status=${status}`);
      setLeaves(r.data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolveLeave = async (id: string, status: "APPROVED" | "REJECTED") => {
    setResolving(id);
    try {
      await api.patch(`/org-admin/leaves/${id}`, { status });
      await loadLeaves(leaveFilter);
    } catch { /* ignore */ }
    setResolving(null);
  };

  const changeLeaveFilter = (f: string) => {
    setLeaveFilter(f);
    loadLeaves(f);
  };

  const kpis = [
    { icon: Users,       label: "Team Members",    value: stats?.members  ?? "—", color: "#6366f1" },
    { icon: FileText,    label: "Total Parties",   value: stats?.parties  ?? "—", color: "#818cf8" },
    { icon: DollarSign,  label: "Invoices",        value: stats?.invoices ?? "—", color: "#10b981" },
    { icon: ShoppingCart,label: "Sales Orders",    value: stats?.orders   ?? "—", color: "#f59e0b" },
    { icon: TrendingUp,  label: "Active Leads",    value: stats?.leads    ?? "—", color: "#a78bfa" },
    { icon: Headphones,  label: "Support Tickets", value: stats?.tickets  ?? "—", color: "#ef4444" },
    { icon: Package,     label: "Products",        value: stats?.products ?? "—", color: "#60a5fa" },
    { icon: BarChart3,   label: "Tasks",           value: stats?.tasks    ?? "—", color: "#34d399" },
  ];

  return (
    <div className="page-pad">
      <div style={S.hdr}>
        <h1 style={S.title}>Dashboard — {activeOrg?.name}</h1>
        <p style={S.sub}>Real-time overview of your organisation across all departments</p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            {kpis.map((k) => (
              <div key={k.label} style={S.kpi}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>{k.label}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: k.color + "20" }}>
                    <k.icon size={14} color={k.color} />
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {/* ── Pending Leave Requests ── */}
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={S.cardTitle}>
                  <Calendar size={15} color="#f59e0b" />
                  Leave Requests
                  {leaveFilter === "PENDING" && leaves.length > 0 && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#f59e0b20", color: "#f59e0b", fontWeight: 700 }}>
                      {leaves.length} pending
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["PENDING", "APPROVED", "REJECTED"].map(f => (
                    <button key={f} onClick={() => changeLeaveFilter(f)} style={{
                      padding: "4px 10px", borderRadius: 6, border: "1px solid",
                      cursor: "pointer", fontSize: 11, fontWeight: 600,
                      borderColor: leaveFilter === f ? "#6366f1" : "var(--border-input)",
                      background:  leaveFilter === f ? "#6366f115" : "transparent",
                      color:       leaveFilter === f ? "#818cf8" : "var(--text-ghost)",
                    }}>{f.charAt(0) + f.slice(1).toLowerCase()}</button>
                  ))}
                </div>
              </div>

              {leaves.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-ghost)", fontSize: 13 }}>
                  <Check size={28} color="#10b981" style={{ display: "block", margin: "0 auto 8px" }} />
                  No {leaveFilter.toLowerCase()} leave requests
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
                  {leaves.map(l => (
                    <div key={l.id} style={{ background: "var(--bg-hover)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{l.employee.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>
                            {l.employee.designation || l.employee.department || l.employee.employeeCode}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 700,
                          background: l.status === "PENDING" ? "#f59e0b20" : l.status === "APPROVED" ? "#10b98120" : "#ef444420",
                          color:      l.status === "PENDING" ? "#f59e0b"   : l.status === "APPROVED" ? "#10b981"   : "#ef4444",
                        }}>{l.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-sec)", marginBottom: l.status === "PENDING" ? 10 : 0 }}>
                        <span style={{ background: "#6366f115", color: "#818cf8", padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{l.leaveType}</span>
                        <span style={{ marginLeft: 8 }}>{fmtDate(l.fromDate)} → {fmtDate(l.toDate)}</span>
                        <span style={{ marginLeft: 8, color: "var(--text-ghost)" }}>({l.days} day{l.days !== 1 ? "s" : ""})</span>
                      </div>
                      {l.reason && <div style={{ fontSize: 11, color: "var(--text-ghost)", marginBottom: l.status === "PENDING" ? 8 : 0, fontStyle: "italic" }}>"{l.reason}"</div>}
                      {l.status === "PENDING" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => resolveLeave(l.id, "APPROVED")} disabled={resolving === l.id} style={S.btnGreen}>
                            <Check size={12} /> Approve
                          </button>
                          <button onClick={() => resolveLeave(l.id, "REJECTED")} disabled={resolving === l.id} style={S.btnRed}>
                            <X size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Live Activity Feed ── */}
            <div style={S.card}>
              <div style={S.cardTitle}>
                <Activity size={15} color="#6366f1" /> Live Activity Feed
              </div>
              {feed.length === 0 ? (
                <div style={{ color: "var(--text-ghost)", textAlign: "center", padding: 32 }}>No activity yet.</div>
              ) : feed.map((item, i) => {
                const cfg = FEED_ICONS[item.type] || { icon: FileText, color: "#818cf8" };
                const color = STATUS_COLORS[item.meta] || "#818cf8";
                return (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bg-hover)", alignItems: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <cfg.icon size={14} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                      {item.subtitle && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{item.subtitle}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                      <span style={{ ...S.tag, background: color + "20", color }}>{item.meta}</span>
                      <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>
                        {new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
