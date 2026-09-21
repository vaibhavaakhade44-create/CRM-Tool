import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Users, CheckCircle, Clock, TrendingUp, AlertCircle, Star, Activity } from "lucide-react";

const S = {
  title:  { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub:    { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  card:   { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  kpi:    { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" } as React.CSSProperties,
  th:     { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td:     { padding: "12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  empty:  { padding: "40px 20px", textAlign: "center" as const, color: "var(--text-ghost)", fontSize: 13 },
  select: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none", colorScheme: "dark" as const },
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "#6366f1", ACTIVE: "#10b981", ON_HOLD: "#f59e0b", COMPLETED: "#818CF8", CANCELLED: "#ef4444",
};
const PRIORITY_C: Record<string, string> = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444", URGENT: "#dc2626" };
const today = new Date();

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: color + "22", color }}>{text.replace(/_/g, " ")}</span>;
}
function ProgressBar({ pct, color = "#6366f1" }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: "width 0.4s" }} />
    </div>
  );
}

function kpiScore(done: number, total: number, overdue: number): number {
  if (total === 0) return 80;
  return Math.max(10, Math.min(100, Math.round(80 + (done / total - 0.5) * 40 - overdue * 5)));
}
function kpiColor(k: number) { return k >= 80 ? "#10b981" : k >= 60 ? "#f59e0b" : "#ef4444"; }
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

interface MyTeamData {
  tlEmployee: { id: string; name: string; designation?: string; department?: string };
  projects: Array<{
    id: string; name: string; status: string; endDate?: string;
    progress: number; _count: { tasks: number };
    members: Array<{
      id: string; employeeId: string; role: string;
      employee: { id: string; name: string; designation?: string; department?: string; employeeCode?: string }
    }>;
    tasks: Array<{ id: string; status: string; assignedToId?: string; title: string; priority: string; dueDate?: string }>;
  }>;
}

export default function TeamPage() {
  const { employeeProfile } = useAuthStore();
  const [data,    setData]    = useState<MyTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selProj, setSelProj] = useState<MyTeamData["projects"][0] | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "tasks">("members");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/projects/my-team");
      setData(r.data.data);
      if (r.data.data?.projects?.length > 0) setSelProj(r.data.data.projects[0]);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const updateTaskStatus = async (taskId: string, status: string) => {
    try { await api.patch(`/projects/tasks/${taskId}`, { status }); load(); }
    catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading your team...</div>;

  if (!data || data.projects.length === 0) {
    return (
      <div className="page-pad">
        <div className="page-hdr" style={{ marginBottom: 20 }}>
          <div><h1 style={S.title}>My Team</h1><p style={S.sub}>Team Lead dashboard</p></div>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: 60, color: "var(--text-ghost)" }}>
          <Users size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0 }}>You have not been assigned as Team Lead in any project yet.</p>
        </div>
      </div>
    );
  }

  const proj = selProj ?? data.projects[0];
  const myMembers = proj.members.filter(m => !["PROJECT_MANAGER", "TECH_LEAD"].includes(m.role));
  const myTasks = proj.tasks;
  const doneTasks    = myTasks.filter(t => t.status === "DONE").length;
  const inProg       = myTasks.filter(t => t.status === "IN_PROGRESS").length;
  const pending      = myTasks.filter(t => t.status === "TODO").length;
  const totalOverdue = myTasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate && new Date(t.dueDate) < today).length;
  const daysLeft = proj.endDate ? Math.ceil((new Date(proj.endDate).getTime() - Date.now()) / 86400000) : null;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
    background: active ? "rgba(99,102,241,0.15)" : "transparent",
    color: active ? "#818CF8" : "var(--text-ghost)",
    borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
  });

  return (
    <div className="page-pad">
      {/* Header */}
      <div className="page-hdr" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={S.title}>My Team</h1>
          <p style={S.sub}>
            {data.tlEmployee.name} · {data.tlEmployee.designation || "Team Lead"} · {data.tlEmployee.department || employeeProfile?.department || ""}
          </p>
        </div>
        {data.projects.length > 1 && (
          <select style={{ ...S.select, padding: "9px 14px", fontSize: 13 }}
            value={proj.id} onChange={e => setSelProj(data.projects.find(p => p.id === e.target.value) || null)}>
            {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Project summary card */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{proj.name}</h2>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
              <Badge text={proj.status} color={STATUS_COLORS[proj.status] || "#818CF8"} />
              {daysLeft !== null && (
                <span style={{ fontSize: 12, color: daysLeft < 0 ? "#ef4444" : daysLeft < 7 ? "#f59e0b" : "var(--text-ghost)" }}>
                  {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `Deadline: ${fmt(proj.endDate)} (${daysLeft}d left)`}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: proj.progress === 100 ? "#10b981" : "var(--text-primary)" }}>{proj.progress}%</div>
            <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>complete</div>
          </div>
        </div>
        <ProgressBar pct={proj.progress} color={proj.progress === 100 ? "#10b981" : "#6366f1"} />
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Team Members", value: myMembers.length, icon: <Users size={18} />, color: "#6366f1" },
          { label: "Tasks Done",   value: doneTasks,         icon: <CheckCircle size={18} />, color: "#10b981" },
          { label: "In Progress",  value: inProg,            icon: <Activity size={18} />, color: "#8b5cf6" },
          { label: "Pending",      value: pending,           icon: <Clock size={18} />, color: "#f59e0b" },
          { label: "Overdue",      value: totalOverdue,      icon: <AlertCircle size={18} />, color: totalOverdue > 0 ? "#ef4444" : "var(--text-ghost)" },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>{k.label}</span>
              <div style={{ padding: 6, borderRadius: 8, background: k.color + "20", color: k.color }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color === "var(--text-ghost)" ? "var(--text-primary)" : k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        <button style={tabStyle(activeTab === "members")} onClick={() => setActiveTab("members")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Users size={13} /> Team Members</span>
        </button>
        <button style={tabStyle(activeTab === "tasks")} onClick={() => setActiveTab("tasks")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle size={13} /> Task Tracker</span>
        </button>
      </div>

      {/* ── TEAM MEMBERS TAB ── */}
      {activeTab === "members" && (
        <div>
          {myMembers.length === 0
            ? <div style={{ ...S.card, ...S.empty }}>No direct reports yet.</div>
            : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                {myMembers.map(m => {
                  const memberTasks   = myTasks.filter(t => t.assignedToId === m.employeeId);
                  const memberDone    = memberTasks.filter(t => t.status === "DONE").length;
                  const memberOverdue = memberTasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate && new Date(t.dueDate) < today).length;
                  const memberKPI     = kpiScore(memberDone, memberTasks.length, memberOverdue);
                  const memberProg    = memberTasks.length ? Math.round((memberDone / memberTasks.length) * 100) : 0;

                  return (
                    <div key={m.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                      {/* Card header */}
                      <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.06))", borderBottom: "1px solid var(--border)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "white", flexShrink: 0 }}>
                          {m.employee.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.employee.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{m.employee.designation || m.role.replace(/_/g, " ")} · {m.employee.department || "—"}</div>
                        </div>
                        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: kpiColor(memberKPI) }}>{memberKPI}</div>
                          <div style={{ fontSize: 9, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>KPI</div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid-r3" style={{ borderBottom: "1px solid var(--border)" }}>
                        {[
                          { label: "Done",    value: memberDone,           color: "#10b981" },
                          { label: "Pending", value: memberTasks.length - memberDone - (memberTasks.filter(t => t.status === "IN_PROGRESS").length), color: "#f59e0b" },
                          { label: "Overdue", value: memberOverdue,        color: memberOverdue > 0 ? "#ef4444" : "var(--text-ghost)" },
                        ].map(s => (
                          <div key={s.label} style={{ padding: "10px 8px", textAlign: "center" as const, borderRight: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 1 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progress */}
                      <div style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-ghost)", marginBottom: 5 }}>
                          <span>Progress ({memberDone}/{memberTasks.length} tasks)</span>
                          <span style={{ fontWeight: 600 }}>{memberProg}%</span>
                        </div>
                        <ProgressBar pct={memberProg} color={memberProg === 100 ? "#10b981" : "#6366f1"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {/* ── TASK TRACKER TAB ── */}
      {activeTab === "tasks" && (
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            All Tasks ({myTasks.length})
          </div>
          {myTasks.length === 0
            ? <div style={S.empty}>No tasks in this project.</div>
            : <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Task", "Priority", "Assigned To", "Due", "Status", "Update"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {myTasks.map(t => {
                  const assignee = proj.members.find(m => m.employeeId === t.assignedToId);
                  const isOverdue = t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < today;
                  return (
                    <tr key={t.id}>
                      <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                        {isOverdue && <AlertCircle size={12} style={{ color: "#ef4444", marginRight: 4, display: "inline" }} />}
                        {t.title}
                      </td>
                      <td style={S.td}><Badge text={t.priority} color={PRIORITY_C[t.priority] || "#818CF8"} /></td>
                      <td style={{ ...S.td, fontSize: 12 }}>{assignee?.employee.name || "Unassigned"}</td>
                      <td style={{ ...S.td, fontSize: 12, color: isOverdue ? "#ef4444" : "var(--text-ghost)" }}>{fmt(t.dueDate)}</td>
                      <td style={S.td}><Badge text={t.status} color={t.status === "DONE" ? "#10b981" : t.status === "IN_PROGRESS" ? "#6366f1" : t.status === "IN_REVIEW" ? "#f59e0b" : "var(--text-ghost)"} /></td>
                      <td style={S.td}>
                        <select value={t.status} onChange={e => updateTaskStatus(t.id, e.target.value)}
                          style={{ ...S.select, width: "auto" }}>
                          {["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          }
        </div>
      )}
    </div>
  );
}
