import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  Briefcase, Users, CheckCircle, Clock, Plus, X, AlertCircle,
  TrendingUp, Calendar, ChevronRight, Edit2, Trash2, GitBranch,
  Star, Target, Activity,
} from "lucide-react";

// ── styles ────────────────────────────────────────────────────────────────────
const S = {
  page:   {} as React.CSSProperties,
  title:  { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub:    { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn:    { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  btnSm:  { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 } as React.CSSProperties,
  btnDanger: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 } as React.CSSProperties,
  btnGreen:  { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 } as React.CSSProperties,
  card:   { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  kpi:    { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  modal:  { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  input:  { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label:  { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  err:    { background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 },
  th:     { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td:     { padding: "12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  empty:  { padding: "40px 20px", textAlign: "center" as const, color: "var(--text-ghost)", fontSize: 13 },
  tab:    (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
    background: active ? "rgba(99,102,241,0.15)" : "transparent",
    color: active ? "#818CF8" : "var(--text-ghost)",
    borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
  }),
};

// ── constants ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  PLANNING: "#6366f1", ACTIVE: "#10b981", ON_HOLD: "#f59e0b",
  COMPLETED: "#818CF8", CANCELLED: "#ef4444",
};
const PRIORITY_C: Record<string, string> = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444", URGENT: "#dc2626" };
const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const PROJECT_MEMBER_ROLES = [
  "PROJECT_MANAGER", "TECH_LEAD", "SENIOR_DEVELOPER", "DEVELOPER",
  "FRONTEND_DEV", "BACKEND_DEV", "FULLSTACK_DEV", "UI_UX_DESIGNER",
  "QA_ENGINEER", "DEVOPS_ENGINEER", "BUSINESS_ANALYST", "SCRUM_MASTER",
];
const ROLE_LABELS: Record<string, string> = {
  PROJECT_MANAGER: "Project Manager", TECH_LEAD: "Team Lead",
  DEVELOPER: "Developer", SENIOR_DEVELOPER: "Sr. Developer",
  FRONTEND_DEV: "Frontend Dev", BACKEND_DEV: "Backend Dev",
  FULLSTACK_DEV: "Full Stack Dev", QA_ENGINEER: "QA Engineer",
  DEVOPS_ENGINEER: "DevOps", UI_UX_DESIGNER: "UI/UX Designer",
  BUSINESS_ANALYST: "Business Analyst", SCRUM_MASTER: "Scrum Master",
};

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const errMsg = (e: unknown) => (e as any)?.response?.data?.message || "Failed";
const today = new Date();

function kpiScore(done: number, total: number, overdue: number): number {
  if (total === 0) return 80;
  const rate = done / total;
  return Math.max(10, Math.min(100, Math.round(80 + (rate - 0.5) * 40 - overdue * 5)));
}
function kpiColor(k: number) { return k >= 80 ? "#10b981" : k >= 60 ? "#f59e0b" : "#ef4444"; }

function Avatar({ name, size = 36, colors = ["#6366f1", "#8b5cf6"] }: { name: string; size?: number; colors?: string[] }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.38), fontWeight: 700, color: "white", background: `linear-gradient(135deg,${colors[0]},${colors[1]})` }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
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

// ── types ─────────────────────────────────────────────────────────────────────
interface Employee { id: string; name: string; designation?: string; department?: string; orgRole?: string; employeeCode?: string; }
interface ProjectMember { id: string; employeeId: string; role: string; employee: Employee; taskCount?: number; doneTasks?: number; }
interface Task { id: string; status: string; assignedToId?: string; title: string; priority: string; dueDate?: string; }
interface Project {
  id: string; name: string; status: string; endDate?: string;
  members: ProjectMember[]; tasks: Task[]; progress: number; _count: { tasks: number };
}
interface TeamData {
  project: { id: string; name: string; status: string; endDate?: string };
  pm: ProjectMember[];
  teamLeads: ProjectMember[];
  employees: ProjectMember[];
  tasks: Task[];
}

// ── Team Card Component ───────────────────────────────────────────────────────
function TeamCard({ tl, members, tasks, onRemoveMember, avatarColors }: {
  tl: ProjectMember; members: ProjectMember[]; tasks: Task[];
  onRemoveMember: (empId: string) => void; avatarColors: string[];
}) {
  const allMembers = [tl, ...members];
  const teamDone = tasks.filter(t => allMembers.some(m => m.employeeId === t.assignedToId) && t.status === "DONE").length;
  const teamTotal = tasks.filter(t => allMembers.some(m => m.employeeId === t.assignedToId)).length;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {/* Team header */}
      <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))", borderBottom: "1px solid var(--border)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{tl.employee.department} Team</div>
          <div style={{ fontSize: 12, color: "var(--text-ghost)", marginTop: 2 }}>
            {allMembers.length} member{allMembers.length !== 1 ? "s" : ""} · {teamDone}/{teamTotal} tasks done
          </div>
        </div>
        <div style={{ padding: "4px 10px", borderRadius: 20, background: "#6366f120", color: "#818CF8", fontSize: 11, fontWeight: 700 }}>
          {teamTotal > 0 ? `${Math.round((teamDone / teamTotal) * 100)}%` : "—"}
        </div>
      </div>

      {/* TL row */}
      <MemberRow member={tl} tasks={tasks} avatarColors={["#6366f1", "#8b5cf6"]} isTL onRemove={onRemoveMember} />

      {/* Dev rows */}
      <div style={{ padding: "0 0 8px" }}>
        {members.map(m => (
          <MemberRow key={m.id} member={m} tasks={tasks} avatarColors={avatarColors} onRemove={onRemoveMember} />
        ))}
        {members.length === 0 && (
          <div style={{ padding: "16px 18px", fontSize: 12, color: "var(--text-ghost)", textAlign: "center" }}>No members yet.</div>
        )}
      </div>
    </div>
  );
}

function MemberRow({ member, tasks, avatarColors, isTL = false, onRemove }: {
  member: ProjectMember; tasks: Task[]; avatarColors: string[]; isTL?: boolean;
  onRemove: (empId: string) => void;
}) {
  const memberTasks = tasks.filter(t => t.assignedToId === member.employeeId);
  const done    = memberTasks.filter(t => t.status === "DONE").length;
  const overdue = memberTasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate && new Date(t.dueDate) < today).length;
  const kpi     = kpiScore(done, memberTasks.length, overdue);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--bg-hover)", transition: "background 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <Avatar name={member.employee.name} size={isTL ? 38 : 32} colors={avatarColors} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: isTL ? 14 : 13, fontWeight: isTL ? 700 : 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {member.employee.name}
        </div>
        <div style={{ fontSize: 11, color: isTL ? "#8b5cf6" : "var(--text-ghost)" }}>
          {isTL ? "Team Lead" : (member.employee.designation || ROLE_LABELS[member.role] || member.role)} · {member.employee.department}
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{done}</div>
          <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>Done</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: overdue > 0 ? "#ef4444" : "var(--text-ghost)" }}>{overdue}</div>
          <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>Overdue</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: kpiColor(kpi) }}>{kpi}</div>
          <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>KPI</div>
        </div>
        <button style={{ ...S.btnDanger, padding: "3px 7px", opacity: 0.7 }}
          title="Remove from project" onClick={() => onRemove(member.employeeId)}>
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ── Org Chart Component ───────────────────────────────────────────────────────
function OrgChart({ teamData, project }: { teamData: TeamData; project: Project }) {
  const allMembers = [...teamData.pm, ...teamData.teamLeads, ...teamData.employees];

  const nodeStyle = (color: string, isMain = false): React.CSSProperties => ({
    background: isMain ? `linear-gradient(135deg,${color}20,${color}10)` : "var(--bg-hover)",
    border: `1px solid ${color}40`,
    borderRadius: 10,
    padding: isMain ? "12px 20px" : "8px 14px",
    display: "flex", alignItems: "center", gap: 10,
    minWidth: isMain ? 200 : 160, maxWidth: isMain ? 240 : 200,
  });

  return (
    <div style={{ overflowX: "auto", padding: "20px 10px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

        {/* Admin (top) */}
        <div style={nodeStyle("#f59e0b", true)}>
          <Avatar name="A" size={36} colors={["#f59e0b", "#d97706"]} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Org Management</div>
            <div style={{ fontSize: 11, color: "#f59e0b" }}>Admin / Owner</div>
          </div>
        </div>
        <div style={{ width: 2, height: 24, background: "var(--border)" }} />

        {/* PM level */}
        {teamData.pm.map(pm => (
          <div key={pm.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={nodeStyle("#6366f1", true)}>
              <Avatar name={pm.employee.name} size={36} colors={["#6366f1", "#8b5cf6"]} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{pm.employee.name}</div>
                <div style={{ fontSize: 11, color: "#6366f1" }}>Project Manager</div>
              </div>
            </div>
            <div style={{ width: 2, height: 24, background: "var(--border)" }} />
          </div>
        ))}

        {/* TLs row */}
        {teamData.teamLeads.length > 0 && (
          <div style={{ position: "relative", display: "flex", gap: 60, alignItems: "flex-start" }}>
            {/* horizontal connector */}
            {teamData.teamLeads.length > 1 && (
              <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 2, background: "var(--border)" }} />
            )}
            {teamData.teamLeads.map((tl, ti) => {
              const tlMembers = teamData.employees.filter(e => e.employee.department === tl.employee.department);
              return (
                <div key={tl.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 2, height: 24, background: "var(--border)" }} />
                  <div style={nodeStyle("#8b5cf6")}>
                    <Avatar name={tl.employee.name} size={30} colors={["#8b5cf6", "#a78bfa"]} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{tl.employee.name}</div>
                      <div style={{ fontSize: 10, color: "#8b5cf6" }}>Team Lead · {tl.employee.department}</div>
                    </div>
                  </div>
                  {tlMembers.length > 0 && <div style={{ width: 2, height: 20, background: "var(--border)" }} />}

                  {/* Members under this TL */}
                  {tlMembers.length > 0 && (
                    <div style={{ position: "relative", display: "flex", gap: 14, flexWrap: "wrap" as const, justifyContent: "center", maxWidth: 520 }}>
                      {tlMembers.length > 1 && (
                        <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 2, background: "var(--border)" }} />
                      )}
                      {tlMembers.map(dev => (
                        <div key={dev.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ width: 2, height: 20, background: "var(--border)" }} />
                          <div style={{ ...nodeStyle("#10b981"), minWidth: 140 }}>
                            <Avatar name={dev.employee.name} size={26} colors={["#10b981", "#059669"]} />
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{dev.employee.name}</div>
                              <div style={{ fontSize: 10, color: "#10b981" }}>{dev.employee.designation?.split(" ").slice(0, 2).join(" ") || ROLE_LABELS[dev.role]?.split(" ").slice(0, 2).join(" ")}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Unmatched employees on last TL */}
                  {ti === teamData.teamLeads.length - 1 && (() => {
                    const unmatched = teamData.employees.filter(e => !teamData.teamLeads.some(t => t.employee.department === e.employee.department));
                    if (unmatched.length === 0) return null;
                    return (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap" as const, gap: 8, justifyContent: "center" }}>
                        {unmatched.map(dev => (
                          <div key={dev.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 2, height: 16, background: "var(--border)" }} />
                            <div style={{ ...nodeStyle("#10b981"), minWidth: 130 }}>
                              <Avatar name={dev.employee.name} size={22} colors={["#10b981", "#059669"]} />
                              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{dev.employee.name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 32, display: "flex", gap: 20, flexWrap: "wrap" as const, justifyContent: "center" }}>
          {[
            { color: "#f59e0b", label: "Management / Admin" },
            { color: "#6366f1", label: "Project Manager" },
            { color: "#8b5cf6", label: "Team Lead" },
            { color: "#10b981", label: "Developer / Engineer" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-ghost)" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PMDashboard() {
  const { employeeProfile } = useAuthStore();

  const [projects,    setProjects]    = useState<Project[]>([]);
  const [selProject,  setSelProject]  = useState<Project | null>(null);
  const [teamData,    setTeamData]    = useState<TeamData | null>(null);
  const [allEmps,     setAllEmps]     = useState<Employee[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [error,       setError]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [activeTab,   setActiveTab]   = useState<"teams" | "tasks" | "orgchart">("teams");

  // modals
  const [showProjModal,   setShowProjModal]   = useState(false);
  const [editProjId,      setEditProjId]      = useState<string | null>(null);
  const [projForm,        setProjForm]        = useState({ name: "", description: "", status: "PLANNING", startDate: "", endDate: "" });
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberForm,      setMemberForm]      = useState({ employeeId: "", role: "DEVELOPER" });
  const [showTaskModal,   setShowTaskModal]   = useState(false);
  const [taskForm,        setTaskForm]        = useState({ title: "", description: "", priority: "MEDIUM", status: "TODO", assignedToId: "", dueDate: "" });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await api.get("/projects/my-projects");
      const projs: Project[] = pRes.data.data || [];
      setProjects(projs);
      if (projs.length > 0 && !selProject) setSelProject(projs[0]);
    } catch { /* ignore */ }
    // HR endpoint is optional — only admins/HR managers can access it
    try {
      const eRes = await api.get("/hr?limit=200");
      setAllEmps(eRes.data.data?.employees || []);
    } catch { /* PM may not have HR access — allEmps stays empty */ }
    setLoading(false);
  }, []);

  const loadTeam = useCallback(async (projectId: string) => {
    setTeamLoading(true);
    try {
      const r = await api.get(`/projects/${projectId}/team`);
      setTeamData(r.data.data);
    } catch { /* ignore */ }
    setTeamLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { if (selProject) loadTeam(selProject.id); }, [selProject, loadTeam]);

  // ── project CRUD ──────────────────────────────────────────────────────────
  const openCreateProject = () => {
    setEditProjId(null);
    setProjForm({ name: "", description: "", status: "PLANNING", startDate: "", endDate: "" });
    setError(""); setShowProjModal(true);
  };
  const openEditProject = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProjId(p.id);
    setProjForm({ name: p.name, description: "", status: p.status, startDate: "", endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "" });
    setError(""); setShowProjModal(true);
  };
  const saveProject = async () => {
    setSaving(true); setError("");
    try {
      const payload = { ...projForm, startDate: projForm.startDate || undefined, endDate: projForm.endDate || undefined, description: projForm.description || undefined };
      if (editProjId) await api.patch(`/projects/${editProjId}`, payload);
      else await api.post("/projects", payload);
      setShowProjModal(false); loadProjects();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };

  // ── member CRUD ───────────────────────────────────────────────────────────
  const saveMember = async () => {
    if (!selProject) return;
    setSaving(true); setError("");
    try {
      await api.post(`/projects/${selProject.id}/members`, memberForm);
      setShowMemberModal(false);
      loadTeam(selProject.id); loadProjects();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const removeMember = async (employeeId: string) => {
    if (!selProject || !confirm("Remove this member from the project?")) return;
    try {
      await api.delete(`/projects/${selProject.id}/members/${employeeId}`);
      loadTeam(selProject.id); loadProjects();
    } catch { alert("Failed to remove"); }
  };

  // ── task CRUD ─────────────────────────────────────────────────────────────
  const saveTask = async () => {
    if (!selProject) return;
    setSaving(true); setError("");
    try {
      await api.post("/projects/tasks", {
        ...taskForm, projectId: selProject.id,
        assignedToId: taskForm.assignedToId || undefined,
        dueDate: taskForm.dueDate || undefined,
        description: undefined,
      });
      setShowTaskModal(false); loadTeam(selProject.id);
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const updateTaskStatus = async (taskId: string, status: string) => {
    try { await api.patch(`/projects/tasks/${taskId}`, { status }); loadTeam(selProject!.id); }
    catch { /* ignore */ }
  };

  // ── derived stats ─────────────────────────────────────────────────────────
  const tasks    = teamData?.tasks ?? [];
  const allTeamMembers = teamData ? [...teamData.pm, ...teamData.teamLeads, ...teamData.employees] : [];
  const totalDone    = tasks.filter(t => t.status === "DONE").length;
  const totalOverdue = tasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate && new Date(t.dueDate) < today).length;
  const inProgress   = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const daysLeft     = selProject?.endDate ? Math.ceil((new Date(selProject.endDate).getTime() - Date.now()) / 86400000) : null;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div>;

  return (
    <div className="page-pad">
      {/* ── Header ── */}
      <div className="page-hdr" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={S.title}>Project Manager Dashboard</h1>
          <p style={S.sub}>
            {employeeProfile ? `Hello, ${employeeProfile.name} · ${employeeProfile.designation || "Project Manager"}` : "Manage your projects, teams, and track progress"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selProject && (
            <>
              <button style={{ ...S.btnSm }} onClick={() => { setMemberForm({ employeeId: "", role: "DEVELOPER" }); setError(""); setShowMemberModal(true); }}>
                <Plus size={12} style={{ display: "inline", marginRight: 4 }} /> Add Member
              </button>
              <button style={{ ...S.btnGreen }} onClick={() => { setTaskForm({ title: "", description: "", priority: "MEDIUM", status: "TODO", assignedToId: "", dueDate: "" }); setError(""); setShowTaskModal(true); }}>
                <Plus size={12} style={{ display: "inline", marginRight: 4 }} /> Add Task
              </button>
            </>
          )}
          <button style={S.btn} onClick={openCreateProject}><Plus size={14} /> New Project</button>
        </div>
      </div>

      {/* ── Project selector + info card ── */}
      {projects.length > 0 && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 12 }}>
            <div style={{ flex: 1 }}>
              {projects.length > 1 ? (
                <select value={selProject?.id ?? ""} onChange={e => setSelProject(projects.find(p => p.id === e.target.value) || null)}
                  style={{ ...S.select, width: "auto", fontSize: 16, fontWeight: 700, padding: "6px 12px" }}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{selProject?.name}</h2>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                {selProject && <Badge text={selProject.status} color={STATUS_COLORS[selProject.status] || "#818CF8"} />}
                {daysLeft !== null && (
                  <span style={{ fontSize: 12, color: daysLeft < 0 ? "#ef4444" : daysLeft < 14 ? "#f59e0b" : "var(--text-ghost)" }}>
                    <Calendar size={11} style={{ display: "inline", marginRight: 3 }} />
                    Deadline: {fmt(selProject?.endDate)}
                    {daysLeft >= 0 ? ` (${daysLeft}d left)` : ` (${Math.abs(daysLeft)}d overdue)`}
                  </span>
                )}
                {selProject && (
                  <button style={{ ...S.btnSm, padding: "3px 8px" }} onClick={e => openEditProject(selProject, e)}>
                    <Edit2 size={11} style={{ display: "inline", marginRight: 3 }} /> Edit
                  </button>
                )}
              </div>
            </div>
            {selProject && (
              <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: selProject.progress === 100 ? "#10b981" : "var(--text-primary)" }}>{selProject.progress}%</div>
                <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>overall progress</div>
              </div>
            )}
          </div>
          {selProject && <div style={{ marginTop: 12 }}><ProgressBar pct={selProject.progress} color={selProject.progress === 100 ? "#10b981" : "#6366f1"} /></div>}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "My Projects", value: projects.length, icon: <Briefcase size={18} />, color: "#6366f1" },
          { label: "Team Members", value: allTeamMembers.length, icon: <Users size={18} />, color: "#8b5cf6" },
          { label: "Tasks Done", value: totalDone, icon: <CheckCircle size={18} />, color: "#10b981" },
          { label: "In Progress", value: inProgress, icon: <Activity size={18} />, color: "#818CF8" },
          { label: "Overdue", value: totalOverdue, icon: <AlertCircle size={18} />, color: totalOverdue > 0 ? "#ef4444" : "var(--text-ghost)" },
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

      {/* ── No project state ── */}
      {projects.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 60, color: "var(--text-ghost)" }}>
          <Briefcase size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: "0 0 16px", fontSize: 14 }}>You have no projects assigned as Project Manager.</p>
          <button style={S.btn} onClick={openCreateProject}><Plus size={14} /> Create Your First Project</button>
        </div>
      )}

      {/* ── Tab Bar ── */}
      {selProject && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {([
              { id: "teams" as const, label: "Teams", icon: <Users size={13} /> },
              { id: "tasks" as const, label: "Task Management", icon: <CheckCircle size={13} /> },
              { id: "orgchart" as const, label: "Org Chart", icon: <GitBranch size={13} /> },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.tab(activeTab === t.id)}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{t.icon} {t.label}</span>
              </button>
            ))}
          </div>

          {teamLoading && <div style={{ padding: 30, textAlign: "center", color: "var(--text-ghost)" }}>Loading team data...</div>}

          {/* ══ TEAMS TAB ══════════════════════════════════════════════════════ */}
          {!teamLoading && activeTab === "teams" && teamData && (
            <div>
              {/* PM row */}
              {teamData.pm.length > 0 && (
                <div style={{ ...S.card, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ padding: "6px 14px", background: "#6366f115", border: "1px solid #6366f130", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#818CF8", flexShrink: 0 }}>
                    PROJECT MANAGER
                  </div>
                  {teamData.pm.map(pm => (
                    <div key={pm.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={pm.employee.name} size={34} colors={["#6366f1", "#8b5cf6"]} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{pm.employee.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{pm.employee.designation || "Project Manager"} · {pm.employee.department}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-ghost)" }}>
                    Deadline: {fmt(teamData.project.endDate)}
                  </div>
                </div>
              )}

              {/* TL → Team cards */}
              {teamData.teamLeads.length === 0 && teamData.employees.length === 0 ? (
                <div style={{ ...S.card, textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>
                  <Users size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ margin: 0 }}>No team members assigned yet. Use "Add Member" to build your team.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: teamData.teamLeads.length > 1 ? "1fr 1fr" : "1fr", gap: 16 }}>
                  {teamData.teamLeads.map(tl => {
                    const tlMembers = teamData.employees.filter(e => e.employee.department === tl.employee.department);
                    return (
                      <TeamCard
                        key={tl.id}
                        tl={tl}
                        members={tlMembers}
                        tasks={tasks}
                        onRemoveMember={removeMember}
                        avatarColors={tl.employee.department === "Backend" ? ["#10b981", "#059669"] : ["#06b6d4", "#0891b2"]}
                      />
                    );
                  })}
                  {/* employees not under any TL */}
                  {(() => {
                    const unmatched = teamData.employees.filter(e => !teamData.teamLeads.some(tl => tl.employee.department === e.employee.department));
                    if (unmatched.length === 0 || teamData.teamLeads.length > 0) return null;
                    return (
                      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ background: "rgba(16,185,129,0.08)", borderBottom: "1px solid var(--border)", padding: "14px 18px" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Team Members</div>
                        </div>
                        {unmatched.map(m => <MemberRow key={m.id} member={m} tasks={tasks} avatarColors={["#10b981", "#059669"]} onRemove={removeMember} />)}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ══ TASK MANAGEMENT TAB ══════════════════════════════════════════ */}
          {!teamLoading && activeTab === "tasks" && teamData && (
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  All Tasks
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-ghost)", fontWeight: 400 }}>
                    {totalDone} done · {inProgress} in progress · {totalOverdue} overdue
                  </span>
                </div>
                <button style={S.btnGreen} onClick={() => { setTaskForm({ title: "", description: "", priority: "MEDIUM", status: "TODO", assignedToId: "", dueDate: "" }); setError(""); setShowTaskModal(true); }}>
                  <Plus size={12} style={{ display: "inline", marginRight: 4 }} /> Add Task
                </button>
              </div>
              {tasks.length === 0
                ? <div style={S.empty}>No tasks yet. Add your first task.</div>
                : <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Task", "Priority", "Assigned To", "Team", "Due Date", "Status", "Update"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => {
                      const assignee = allTeamMembers.find(m => m.employeeId === t.assignedToId);
                      const isOverdue = t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < today;
                      return (
                        <tr key={t.id} style={{ opacity: t.status === "CANCELLED" ? 0.5 : 1 }}>
                          <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 500, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {isOverdue && <AlertCircle size={11} style={{ color: "#ef4444", marginRight: 4, display: "inline" }} />}
                            {t.title}
                          </td>
                          <td style={S.td}><Badge text={t.priority} color={PRIORITY_C[t.priority] || "#818CF8"} /></td>
                          <td style={{ ...S.td, fontSize: 12 }}>
                            {assignee ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Avatar name={assignee.employee.name} size={22} colors={["#6366f1", "#8b5cf6"]} />
                                {assignee.employee.name}
                              </div>
                            ) : "Unassigned"}
                          </td>
                          <td style={{ ...S.td, fontSize: 11, color: "var(--text-ghost)" }}>{assignee?.employee.department || "—"}</td>
                          <td style={{ ...S.td, fontSize: 12, color: isOverdue ? "#ef4444" : "var(--text-ghost)" }}>
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                          </td>
                          <td style={S.td}><Badge text={t.status} color={t.status === "DONE" ? "#10b981" : t.status === "IN_PROGRESS" ? "#6366f1" : t.status === "IN_REVIEW" ? "#f59e0b" : "var(--text-ghost)"} /></td>
                          <td style={S.td}>
                            <select value={t.status} onChange={e => updateTaskStatus(t.id, e.target.value)}
                              style={{ ...S.select, width: "auto", padding: "3px 8px", fontSize: 11 }}>
                              {["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
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

          {/* ══ ORG CHART TAB ════════════════════════════════════════════════ */}
          {!teamLoading && activeTab === "orgchart" && teamData && (
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                <GitBranch size={14} style={{ display: "inline", marginRight: 6 }} />
                Organisation Hierarchy
              </div>
              <div style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 16 }}>
                Employee → Team Lead → Project Manager → Management
              </div>
              {selProject && <OrgChart teamData={teamData} project={selProject} />}
            </div>
          )}
        </>
      )}

      {/* ══ PROJECT MODAL ════════════════════════════════════════════════════ */}
      {showProjModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowProjModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>{editProjId ? "Edit Project" : "New Project"}</h3>
              <button onClick={() => setShowProjModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={S.err}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
              <div><label style={S.label}>Project Name *</label><input style={S.input} value={projForm.name} onChange={e => setProjForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Deployra Cloud Platform" /></div>
              <div><label style={S.label}>Description</label><textarea style={{ ...S.input, height: 70, resize: "none" as const }} value={projForm.description} onChange={e => setProjForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid-r2">
                <div><label style={S.label}>Status</label><select style={S.select} value={projForm.status} onChange={e => setProjForm(p => ({ ...p, status: e.target.value }))}>{PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
                <div><label style={S.label}>Deadline</label><input type="date" style={S.input} value={projForm.endDate} onChange={e => setProjForm(p => ({ ...p, endDate: e.target.value }))} /></div>
              </div>
              <div><label style={S.label}>Start Date</label><input type="date" style={S.input} value={projForm.startDate} onChange={e => setProjForm(p => ({ ...p, startDate: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowProjModal(false)} style={{ ...S.btn, background: "var(--border)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveProject} style={S.btn} disabled={saving || !projForm.name}>{saving ? "Saving..." : editProjId ? "Update" : "Create Project"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD MEMBER MODAL ════════════════════════════════════════════════ */}
      {showMemberModal && selProject && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowMemberModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>Add Team Member</h3>
              <button onClick={() => setShowMemberModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={S.err}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
              <div>
                <label style={S.label}>Employee *</label>
                <select style={S.select} value={memberForm.employeeId} onChange={e => setMemberForm(p => ({ ...p, employeeId: e.target.value }))}>
                  <option value="">Select employee...</option>
                  {allEmps.filter(e => !selProject.members.some(m => m.employeeId === e.id)).map(e => (
                    <option key={e.id} value={e.id}>{e.name}{e.designation ? ` (${e.designation})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Role in Project *</label>
                <select style={S.select} value={memberForm.role} onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}>
                  {PROJECT_MEMBER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowMemberModal(false)} style={{ ...S.btn, background: "var(--border)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveMember} style={S.btn} disabled={saving || !memberForm.employeeId}>{saving ? "Adding..." : "Add Member"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD TASK MODAL ══════════════════════════════════════════════════ */}
      {showTaskModal && selProject && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowTaskModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>Add Task — {selProject.name}</h3>
              <button onClick={() => setShowTaskModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={S.err}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
              <div><label style={S.label}>Task Title *</label><input style={S.input} value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Implement login API" /></div>
              <div className="grid-r2">
                <div><label style={S.label}>Priority</label><select style={S.select} value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label style={S.label}>Status</label><select style={S.select} value={taskForm.status} onChange={e => setTaskForm(p => ({ ...p, status: e.target.value }))}>{["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
              </div>
              <div>
                <label style={S.label}>Assign To</label>
                <select style={S.select} value={taskForm.assignedToId} onChange={e => setTaskForm(p => ({ ...p, assignedToId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {selProject.members.map(m => <option key={m.id} value={m.employeeId}>{m.employee.name} — {m.employee.department || ROLE_LABELS[m.role]}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Due Date</label><input type="date" style={S.input} value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowTaskModal(false)} style={{ ...S.btn, background: "var(--border)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveTask} style={S.btn} disabled={saving || !taskForm.title}>{saving ? "Adding..." : "Add Task"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
