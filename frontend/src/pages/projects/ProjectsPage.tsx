import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Kanban, Plus, Search, X } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  tabs: { display: "flex", gap: 4, marginBottom: 24 } as React.CSSProperties,
  tab: (a: boolean) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: a ? "rgba(99,102,241,0.15)" : "transparent", color: a ? "#818CF8" : "var(--text-ghost)" }) as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16 } as React.CSSProperties,
  searchWrap: { position: "relative" as const, flex: 1, maxWidth: 300 },
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  searchIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 480, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  taskCol: { flex: 1, background: "var(--bg-hover)", borderRadius: 10, padding: 14, minHeight: 200 } as React.CSSProperties,
  taskCard: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, cursor: "pointer" } as React.CSSProperties,
};

const PROJ_COLORS: Record<string, string> = { PLANNING: "#818cf8", ACTIVE: "#10b981", ON_HOLD: "#f59e0b", COMPLETED: "#6366f1", CANCELLED: "#ef4444" };
const TASK_COLORS: Record<string, string> = { TODO: "#818cf8", IN_PROGRESS: "#f59e0b", IN_REVIEW: "#60a5fa", DONE: "#10b981", CANCELLED: "#6b7280" };
const PRIORITY_COLORS: Record<string, string> = { LOW: "#6b7280", MEDIUM: "#818cf8", HIGH: "#f59e0b", URGENT: "#ef4444" };

interface Project { id: string; name: string; status: string; startDate?: string; endDate?: string; budget?: number; _count?: { tasks: number }; }
interface Task { id: string; title: string; status: string; priority: string; dueDate?: string; project?: { name: string } | null; }

const TASK_COLS = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"projects" | "tasks">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projForm, setProjForm] = useState({ name: "", description: "", status: "PLANNING", startDate: "", endDate: "", budget: "" });
  const [taskForm, setTaskForm] = useState({ projectId: "", title: "", description: "", status: "TODO", priority: "MEDIUM", dueDate: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        api.get(`/projects?search=${search}&limit=100`),
        api.get("/projects/tasks?limit=200"),
      ]);
      setProjects(pRes.data.data.projects);
      setTasks(tRes.data.data.tasks);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const saveProject = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/projects", { ...projForm, budget: projForm.budget ? parseFloat(projForm.budget) : undefined, startDate: projForm.startDate || undefined, endDate: projForm.endDate || undefined });
      setShowModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const saveTask = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/projects/tasks", { ...taskForm, projectId: taskForm.projectId || undefined, dueDate: taskForm.dueDate || undefined });
      setShowTaskModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const updateTask = async (id: string, status: string) => {
    try { await api.patch(`/projects/tasks/${id}`, { status }); load(); } catch { /* ignore */ }
  };

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>{ t('page_projects') }</h1>
          <p style={S.subtitle}>Track projects, assign tasks, and monitor progress</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }} onClick={() => { setTaskForm({ projectId: "", title: "", description: "", status: "TODO", priority: "MEDIUM", dueDate: "" }); setError(""); setShowTaskModal(true); }}>
            <Plus size={14} /> Add Task
          </button>
          <button style={S.btn} onClick={() => { setProjForm({ name: "", description: "", status: "PLANNING", startDate: "", endDate: "", budget: "" }); setError(""); setShowModal(true); }}>
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      <div style={S.tabs}>
        <button style={S.tab(tab === "projects")} onClick={() => setTab("projects")}><Kanban size={14} style={{ display: "inline", marginRight: 6 }} />Projects ({projects.length})</button>
        <button style={S.tab(tab === "tasks")} onClick={() => setTab("tasks")}>Task Board ({tasks.length})</button>
      </div>

      {tab === "projects" && (
        <div style={S.card}>
          <div style={S.toolbar}>
            <div style={S.searchWrap}>
              <Search size={14} style={S.searchIcon} />
              <input style={S.searchInput} placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
            <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Project", "Status", "Start", "End", "Budget", "Tasks"].map(h => <th key={h} style={{ ...S.th, whiteSpace: "nowrap" as const }}>{h}</th>)}</tr></thead>
              <tbody>
                {projects.length === 0 ? <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No projects yet.</td></tr> : projects.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 500 }}>{p.name}</td>
                    <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (PROJ_COLORS[p.status] || "#818cf8") + "20", color: PROJ_COLORS[p.status] || "#818cf8" }}>{p.status}</span></td>
                    <td style={S.td}>{p.startDate ? new Date(p.startDate).toLocaleDateString("en-IN") : "—"}</td>
                    <td style={S.td}>{p.endDate ? new Date(p.endDate).toLocaleDateString("en-IN") : "—"}</td>
                    <td style={S.td}>{p.budget ? `₹${p.budget.toLocaleString("en-IN")}` : "—"}</td>
                    <td style={S.td}>{p._count?.tasks || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div style={{ display: "flex", gap: 16, overflowX: "auto" as const }}>
          {TASK_COLS.map(col => (
            <div key={col} style={{ ...S.taskCol, minWidth: 240 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: TASK_COLORS[col] }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{col.replace("_", " ")}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-ghost)" }}>{tasks.filter(t => t.status === col).length}</span>
              </div>
              {tasks.filter(t => t.status === col).map(task => (
                <div key={task.id} style={S.taskCard}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{task.title}</p>
                  {task.project && <p style={{ margin: "0 0 6px", fontSize: 11, color: "#818CF8" }}>{task.project.name}</p>}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ padding: "2px 6px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: (PRIORITY_COLORS[task.priority] || "#818cf8") + "25", color: PRIORITY_COLORS[task.priority] || "#818cf8" }}>{task.priority}</span>
                    {task.dueDate && <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>{new Date(task.dueDate).toLocaleDateString("en-IN")}</span>}
                  </div>
                  {col !== "DONE" && (
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                      {col === "TODO" && <button onClick={() => updateTask(task.id, "IN_PROGRESS")} style={{ fontSize: 10, padding: "2px 6px", background: "#f59e0b20", color: "#f59e0b", border: "none", borderRadius: 4, cursor: "pointer" }}>Start</button>}
                      {col === "IN_PROGRESS" && <button onClick={() => updateTask(task.id, "IN_REVIEW")} style={{ fontSize: 10, padding: "2px 6px", background: "#60a5fa20", color: "#60a5fa", border: "none", borderRadius: 4, cursor: "pointer" }}>Review</button>}
                      {col === "IN_REVIEW" && <button onClick={() => updateTask(task.id, "DONE")} style={{ fontSize: 10, padding: "2px 6px", background: "#10b98120", color: "#10b981", border: "none", borderRadius: 4, cursor: "pointer" }}>Done</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Project</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Project Name *</label><input style={S.input} value={projForm.name} onChange={(e) => setProjForm({ ...projForm, name: e.target.value })} /></div>
              <div><label style={S.label}>Description</label><textarea style={{ ...S.input, minHeight: 72, resize: "vertical" as const }} value={projForm.description} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} /></div>
              <div className="grid-r2">
                <div><label style={S.label}>Status</label>
                  <select style={S.select} value={projForm.status} onChange={(e) => setProjForm({ ...projForm, status: e.target.value })}>
                    {Object.keys(PROJ_COLORS).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Budget ₹</label><input type="number" style={S.input} value={projForm.budget} onChange={(e) => setProjForm({ ...projForm, budget: e.target.value })} /></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Start Date</label><input type="date" style={S.input} value={projForm.startDate} onChange={(e) => setProjForm({ ...projForm, startDate: e.target.value })} /></div>
                <div><label style={S.label}>End Date</label><input type="date" style={S.input} value={projForm.endDate} onChange={(e) => setProjForm({ ...projForm, endDate: e.target.value })} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveProject} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Create Project"}</button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowTaskModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Task</h3>
              <button onClick={() => setShowTaskModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Title *</label><input style={S.input} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
              <div><label style={S.label}>Project</label>
                <select style={S.select} value={taskForm.projectId} onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}>
                  <option value="">— No Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Priority</label>
                  <select style={S.select} value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    {["LOW","MEDIUM","HIGH","URGENT"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Due Date</label><input type="date" style={S.input} value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
              </div>
              <div><label style={S.label}>Description</label><textarea style={{ ...S.input, minHeight: 60, resize: "vertical" as const }} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowTaskModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveTask} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Add Task"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
