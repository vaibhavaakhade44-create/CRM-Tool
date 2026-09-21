import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { CheckCircle, Clock, AlertCircle, User, Users, Briefcase, Activity, Calendar, TrendingUp } from "lucide-react";
import TodaysFollowUps from "@/components/TodaysFollowUps";

const today = new Date();

const PRIORITY_C: Record<string, string> = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444", URGENT: "#dc2626" };
const STATUS_C: Record<string, string> = {
  TODO: "#818CF8", IN_PROGRESS: "#6366f1", IN_REVIEW: "#f59e0b", DONE: "#10b981", CANCELLED: "#6b7280",
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: color + "22", color }}>
      {text.replace(/_/g, " ")}
    </span>
  );
}

function PersonCard({ label, name, designation, department, color }: {
  label: string; name: string; designation?: string; department?: string; color: string;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: `1px solid var(--border)`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "white", flexShrink: 0 }}>
        {name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{designation}{department ? ` · ${department}` : ""}</div>
      </div>
    </div>
  );
}

interface MyTask {
  id: string; title: string; status: string; priority: string; dueDate?: string;
  project?: { id: string; name: string; status: string } | null;
}
interface EmpInfo {
  id: string; name: string; designation?: string; orgRole?: string; department?: string; employeeCode?: string;
}
interface PersonRef { id: string; name: string; designation?: string; department?: string; }

interface MyData {
  employee: EmpInfo | null;
  tasks: MyTask[];
  teamLeads: PersonRef[];
  projectManagers: PersonRef[];
  projects: Array<{ id: string; name: string; status: string; endDate?: string }>;
}

export default function EmployeeDashboard() {
  const { employeeProfile, activeOrg } = useAuthStore();
  const [data, setData] = useState<MyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "DONE">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/projects/my-tasks");
      setData(r.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const updateStatus = async (taskId: string, status: string) => {
    try { await api.patch(`/projects/tasks/${taskId}`, { status }); load(); }
    catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [load]);

  const name = data?.employee?.name || employeeProfile?.name || "You";
  const designation = data?.employee?.designation || employeeProfile?.designation || "";
  const department = data?.employee?.department || employeeProfile?.department || "";
  const empCode = data?.employee?.employeeCode || employeeProfile?.employeeCode || "";
  const orgName = activeOrg?.name || "";
  const dayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const tasks = data?.tasks ?? [];
  const done    = tasks.filter(t => t.status === "DONE").length;
  const inProg  = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const todo    = tasks.filter(t => t.status === "TODO").length;
  const overdue = tasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate && new Date(t.dueDate) < today).length;

  const filteredTasks = filter === "ALL" ? tasks : tasks.filter(t => t.status === filter);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading your dashboard...</div>;

  return (
    <div className="page-pad" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Welcome back, {name.split(" ")[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 4 }}>{dayStr} · {orgName}</p>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 16px", textAlign: "right" as const }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{designation || "Team Member"}</div>
          <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{department}{empCode ? ` · ${empCode}` : ""}</div>
        </div>
      </div>

      <TodaysFollowUps />

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Tasks",  value: tasks.length, icon: <Briefcase size={18} />,  color: "#6366f1" },
          { label: "In Progress",  value: inProg,        icon: <Activity size={18} />,   color: "#8b5cf6" },
          { label: "To Do",        value: todo,          icon: <Clock size={18} />,       color: "#f59e0b" },
          { label: "Completed",    value: done,          icon: <CheckCircle size={18} />, color: "#10b981" },
          { label: "Overdue",      value: overdue,       icon: <AlertCircle size={18} />, color: overdue > 0 ? "#ef4444" : "var(--text-ghost)" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-ghost)", fontWeight: 500 }}>{k.label}</span>
              <div style={{ padding: 6, borderRadius: 8, background: k.color + "20", color: k.color }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color === "var(--text-ghost)" ? "var(--text-primary)" : k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* People + Projects */}
      <div className="grid-r2" style={{ gap: 14 }}>

        {/* Left: TL and PM */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {data?.teamLeads && data.teamLeads.length > 0
            ? data.teamLeads.map(tl => (
              <PersonCard key={tl.id} label="Your Team Lead" name={tl.name} designation={tl.designation} department={tl.department} color="#8b5cf6" />
            ))
            : (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 12, color: "var(--text-ghost)" }}>
                <Users size={20} /> <span style={{ fontSize: 13 }}>No Team Lead assigned yet</span>
              </div>
            )
          }
          {data?.projectManagers && data.projectManagers.length > 0
            ? data.projectManagers.map(pm => (
              <PersonCard key={pm.id} label="Your Project Manager" name={pm.name} designation={pm.designation} department={pm.department} color="#6366f1" />
            ))
            : (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 12, color: "var(--text-ghost)" }}>
                <User size={20} /> <span style={{ fontSize: 13 }}>No Project Manager assigned yet</span>
              </div>
            )
          }
        </div>

        {/* Right: My Projects */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Briefcase size={14} /> My Projects
          </div>
          {!data?.projects || data.projects.length === 0
            ? <div style={{ fontSize: 13, color: "var(--text-ghost)", padding: "16px 0" }}>Not assigned to any project yet.</div>
            : data.projects.map(p => {
              const daysLeft = p.endDate ? Math.ceil((new Date(p.endDate).getTime() - Date.now()) / 86400000) : null;
              const statusColor: Record<string, string> = { PLANNING: "#6366f1", ACTIVE: "#10b981", ON_HOLD: "#f59e0b", COMPLETED: "#818CF8", CANCELLED: "#ef4444" };
              return (
                <div key={p.id} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.name}</div>
                    <Badge text={p.status} color={statusColor[p.status] || "#818CF8"} />
                  </div>
                  {daysLeft !== null && (
                    <div style={{ fontSize: 11, color: daysLeft < 0 ? "#ef4444" : daysLeft < 14 ? "#f59e0b" : "var(--text-ghost)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={10} />
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Task List */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
            My Tasks
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-ghost)", fontWeight: 400 }}>
              {done} done · {inProg} in progress · {overdue > 0 ? `${overdue} overdue` : "none overdue"}
            </span>
          </div>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: filter === f ? "#6366f120" : "transparent",
                  color: filter === f ? "#818CF8" : "var(--text-ghost)" }}>
                {f === "IN_PROGRESS" ? "In Progress" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>
            {tasks.length === 0 ? "No tasks assigned yet." : "No tasks match this filter."}
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Task", "Project", "Priority", "Due Date", "Status", "Update"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => {
                  const isOverdue = t.dueDate && t.status !== "DONE" && t.status !== "CANCELLED" && new Date(t.dueDate) < today;
                  return (
                    <tr key={t.id} style={{ opacity: t.status === "CANCELLED" ? 0.5 : 1 }}>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-primary)", fontWeight: 500, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderBottom: "1px solid var(--bg-hover)" }}>
                        {isOverdue && <AlertCircle size={11} style={{ color: "#ef4444", marginRight: 4, display: "inline" }} />}
                        {t.title}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-ghost)", borderBottom: "1px solid var(--bg-hover)", whiteSpace: "nowrap" as const }}>
                        {t.project?.name || "—"}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--bg-hover)" }}>
                        <Badge text={t.priority} color={PRIORITY_C[t.priority] || "#818CF8"} />
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: isOverdue ? "#ef4444" : "var(--text-ghost)", borderBottom: "1px solid var(--bg-hover)", whiteSpace: "nowrap" as const }}>
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--bg-hover)" }}>
                        <Badge text={t.status} color={STATUS_C[t.status] || "#818CF8"} />
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--bg-hover)" }}>
                        <select
                          value={t.status}
                          onChange={e => updateStatus(t.id, e.target.value)}
                          style={{ background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 6, padding: "4px 8px", color: "var(--text-primary)", fontSize: 11, outline: "none", colorScheme: "dark", cursor: "pointer" }}>
                          {["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
