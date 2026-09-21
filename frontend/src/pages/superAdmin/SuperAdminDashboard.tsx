import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Building2, Users, CheckCircle, XCircle, TrendingUp, Clock } from "lucide-react";

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 24 } as React.CSSProperties,
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, marginBottom: 4 } as React.CSSProperties,
};

const PLAN_COLORS: Record<string, string> = { FREE: "#6b7280", STARTER: "#6366f1", PRO: "#f59e0b", ENTERPRISE: "#10b981" };

interface Stats {
  totalOrgs: number; activeOrgs: number; inactiveOrgs: number; totalUsers: number;
  recentOrgs: Array<{ id: string; name: string; createdAt: string; isActive: boolean; plan: string; _count: { members: number } }>;
  planCounts: Array<{ plan: string; _count: { _all: number } }>;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/super-admin/stats").then(r => { setStats(r.data.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading platform stats...</div>;

  return (
    <div style={S.page}>
      <h1 style={S.title}>Platform Dashboard</h1>
      <p style={S.subtitle}>Overview of all organizations and users on BusinessOS</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Building2, label: "Total Organizations", value: stats?.totalOrgs ?? 0, color: "#6366f1" },
          { icon: CheckCircle, label: "Active Orgs", value: stats?.activeOrgs ?? 0, color: "#10b981" },
          { icon: XCircle, label: "Inactive Orgs", value: stats?.inactiveOrgs ?? 0, color: "#ef4444" },
          { icon: Users, label: "Total Users", value: stats?.totalUsers ?? 0, color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>{k.label}</span>
              <k.icon size={15} color={k.color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-r2" style={{ gap: 20 }}>
        {/* Recent Organizations */}
        <div style={S.card}>
          <div style={S.cardTitle}><Clock size={15} color="#818cf8" /> Recently Joined Organizations</div>
          {stats?.recentOrgs?.length === 0 ? (
            <div style={{ color: "var(--text-ghost)", fontSize: 13, textAlign: "center", padding: 20 }}>No organizations yet.</div>
          ) : stats?.recentOrgs?.map(o => (
            <div key={o.id} style={{ ...S.row, background: "var(--bg-hover)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{o.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{new Date(o.createdAt).toLocaleDateString("en-IN")} · {o._count.members} member{o._count.members !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: (PLAN_COLORS[o.plan] || "#6b7280") + "20", color: PLAN_COLORS[o.plan] || "#6b7280", fontWeight: 600 }}>{o.plan}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.isActive ? "#10b981" : "#ef4444", display: "inline-block" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Plan Distribution */}
        <div style={S.card}>
          <div style={S.cardTitle}><TrendingUp size={15} color="#f59e0b" /> Plan Distribution</div>
          {stats?.planCounts?.length === 0 ? (
            <div style={{ color: "var(--text-ghost)", fontSize: 13, textAlign: "center", padding: 20 }}>No data.</div>
          ) : stats?.planCounts?.map(p => (
            <div key={p.plan} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--bg-hover)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLAN_COLORS[p.plan] || "#6b7280" }} />
                <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{p.plan}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: Math.max(4, (p._count._all / (stats?.totalOrgs || 1)) * 100) + "px", height: 6, borderRadius: 3, background: PLAN_COLORS[p.plan] || "#6b7280", transition: "width 0.3s" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: PLAN_COLORS[p.plan] || "var(--text-primary)", minWidth: 24, textAlign: "right" }}>{p._count._all}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
