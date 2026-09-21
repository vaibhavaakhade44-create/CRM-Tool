import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Users, CheckCircle, Clock, AlertCircle, Activity, Layers, Search } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

const ATT_COLOR: Record<string, { bg: string; color: string }> = {
  PRESENT:     { bg: "#14532d", color: "#4ade80" },
  ABSENT:      { bg: "#450a0a", color: "#f87171" },
  HALF_DAY:    { bg: "#451a03", color: "#fbbf24" },
  LEAVE:       { bg: "#1e1b4b", color: "#818cf8" },
  LATE:        { bg: "#44403c", color: "#d97706" },
  WORK_FROM_HOME: { bg: "#0c4a6e", color: "#38bdf8" },
};

const ROLE_SHORT: Record<string, string> = {
  PROJECT_MANAGER: "PM", PROJECT_INCHARGE: "PI", TECH_LEAD: "TL",
  DEVELOPER: "Dev", FRONTEND_DEV: "FE", BACKEND_DEV: "BE",
  FULLSTACK_DEV: "FS", QA_ENGINEER: "QA", UI_UX_DESIGNER: "UI",
  DEVOPS_ENGINEER: "DO", SCRUM_MASTER: "SM", BUSINESS_ANALYST: "BA",
};

function MiniBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div title={`${done}/${total} tasks done`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "#1e293b", borderRadius: 99, minWidth: 40 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct > 70 ? "#4ade80" : pct > 30 ? "#fbbf24" : "#6366f1", borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-ghost)", minWidth: 30 }}>{done}/{total}</span>
    </div>
  );
}

interface EmpRow {
  id: string; name: string; designation?: string; department?: string; email?: string;
  tasks: { todo: number; inProgress: number; done: number; total: number };
  todayAttendance: string;
  projectMembers: { role: string; project: { id: string; name: string; status: string } }[];
}

export default function TeamDashboardPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [selEmp, setSelEmp] = useState<EmpRow | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/it-projects/team-dashboard`, {
      headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id },
    });
    if (r.ok) {
      const d = await r.json();
      setEmployees(d.data?.employees ?? []);
      setProjects(d.data?.projects ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeOrg?.id]);

  const departments = ["ALL", ...Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[]];

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.designation?.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "ALL" || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  const totalPresent = employees.filter(e => e.todayAttendance === "PRESENT" || e.todayAttendance === "WORK_FROM_HOME").length;
  const totalInProgress = employees.reduce((s, e) => s + e.tasks.inProgress, 0);
  const totalDone = employees.reduce((s, e) => s + e.tasks.done, 0);
  const totalTasks = employees.reduce((s, e) => s + e.tasks.total, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_team_dashboard') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>HR view — all employees, projects &amp; task progress</p>
        </div>
        <button onClick={load} style={{ padding: "8px 16px", borderRadius: 10, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 13 }}>
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Team Size", value: employees.length, icon: Users, color: "#818cf8" },
          { label: "Present Today", value: totalPresent, icon: Activity, color: "#4ade80" },
          { label: "Tasks In Progress", value: totalInProgress, icon: Clock, color: "#fbbf24" },
          { label: `Done (${totalTasks} total)`, value: totalDone, icon: CheckCircle, color: "#a78bfa" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon style={{ width: 13, height: 13, color }} />
              <span className="text-xs" style={{ color: "var(--text-ghost)" }}>{label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-40 rounded-xl px-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Search style={{ width: 12, height: 12, color: "var(--text-ghost)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
            className="text-xs py-2 flex-1 bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {departments.map(d => <option key={d} value={d}>{d === "ALL" ? "All Departments" : d}</option>)}
        </select>
      </div>

      {/* Employee table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead>
              <tr style={{ background: "var(--bg-hover)" }}>
                {["Employee", "Department", "Today", "Projects", "Tasks Progress", "Action"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold" style={{ color: "var(--text-ghost)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => {
                const attCfg = ATT_COLOR[emp.todayAttendance] ?? ATT_COLOR.ABSENT;
                const activeProjects = emp.projectMembers.filter(pm => pm.project.status === "ACTIVE");
                return (
                  <tr key={emp.id} style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{emp.name}</p>
                          {emp.designation && <p style={{ fontSize: 10, color: "var(--text-ghost)" }}>{emp.designation}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{emp.department ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: attCfg.bg, color: attCfg.color, fontWeight: 700 }}>
                        {emp.todayAttendance.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {activeProjects.slice(0, 2).map(pm => (
                          <span key={pm.project.id} title={`${pm.project.name} (${ROLE_SHORT[pm.role] ?? pm.role})`}
                            style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#1e1b4b", color: "#a5b4fc", border: "1px solid #312e81" }}>
                            {pm.project.name.slice(0, 12)}{pm.project.name.length > 12 ? "…" : ""} <span style={{ color: "#818cf8" }}>({ROLE_SHORT[pm.role] ?? "Dev"})</span>
                          </span>
                        ))}
                        {activeProjects.length > 2 && <span style={{ fontSize: 9, color: "var(--text-ghost)" }}>+{activeProjects.length - 2}</span>}
                        {activeProjects.length === 0 && <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: 120 }}>
                      {emp.tasks.total > 0 ? <MiniBar done={emp.tasks.done} total={emp.tasks.total} /> : <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>No tasks</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelEmp(emp)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-hover)", color: "#818cf8", border: "1px solid #312e81", cursor: "pointer" }}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle style={{ width: 28, height: 28, color: "var(--text-ghost)", margin: "0 auto 8px" }} />
              <p className="text-xs" style={{ color: "var(--text-ghost)" }}>No employees found</p>
            </div>
          )}
        </div>
      )}

      {/* Employee detail panel */}
      {selEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSelEmp(null)}>
          <div className="h-full overflow-y-auto w-full md:w-[400px] p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>{selEmp.name.charAt(0)}</div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{selEmp.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-ghost)" }}>{selEmp.designation ?? "—"} · {selEmp.department ?? "—"}</p>
                </div>
              </div>
              <button onClick={() => setSelEmp(null)} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-ghost)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>✕</button>
            </div>

            {/* Task stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
              {[["To Do", selEmp.tasks.todo, "#94a3b8"], ["In Progress", selEmp.tasks.inProgress, "#fbbf24"], ["Done", selEmp.tasks.done, "#4ade80"]].map(([l, v, c]) => (
                <div key={String(l)} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-hover)" }}>
                  <p className="text-xl font-bold" style={{ color: String(c) }}>{v}</p>
                  <p style={{ fontSize: 10, color: "var(--text-ghost)" }}>{l}</p>
                </div>
              ))}
            </div>

            {/* Projects */}
            <div className="mb-4">
              <p className="text-xs font-bold mb-2" style={{ color: "var(--text-secondary)" }}>Projects</p>
              {selEmp.projectMembers.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-ghost)" }}>Not assigned to any project</p>
              ) : (
                <div className="space-y-2">
                  {selEmp.projectMembers.map((pm: any, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--bg-hover)" }}>
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{pm.project.name}</p>
                        <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>{pm.project.status}</span>
                      </div>
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: "#312e81", color: "#c7d2fe", fontWeight: 700 }}>
                        {ROLE_SHORT[pm.role] ?? pm.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Today attendance */}
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: "var(--text-secondary)" }}>Today's Attendance</p>
              {(() => { const c = ATT_COLOR[selEmp.todayAttendance] ?? ATT_COLOR.ABSENT; return (
                <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: c.bg, color: c.color, fontWeight: 700 }}>
                  {selEmp.todayAttendance.replace(/_/g, " ")}
                </span>
              );})()}
            </div>

            {/* Project list */}
            {projects.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
                  <Layers style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />Active Projects Overview
                </p>
                <div className="space-y-2">
                  {projects.filter((p: any) => p.status === "ACTIVE").slice(0, 5).map((p: any) => (
                    <div key={p.id} className="px-3 py-2 rounded-lg" style={{ background: "var(--bg-hover)" }}>
                      <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Users style={{ width: 10, height: 10, color: "var(--text-ghost)" }} />
                        <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>{p._count?.tasks ?? 0} tasks · {p.members?.length ?? 0} members</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
