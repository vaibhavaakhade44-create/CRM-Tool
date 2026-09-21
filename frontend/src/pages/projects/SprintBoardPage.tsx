import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Clock, User, ChevronDown, Play, CheckCircle, Timer } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
type TStatus = typeof STATUSES[number];

const STATUS_CONFIG: Record<TStatus, { label: string; color: string; bg: string }> = {
  TODO:        { label: "To Do",      color: "#94a3b8", bg: "#1e293b" },
  IN_PROGRESS: { label: "In Progress",color: "#fbbf24", bg: "#451a03" },
  IN_REVIEW:   { label: "In Review",  color: "#a78bfa", bg: "#1e1b4b" },
  DONE:        { label: "Done",       color: "#4ade80", bg: "#14532d" },
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#60a5fa", MEDIUM: "#fbbf24", HIGH: "#f97316", URGENT: "#f87171",
};

function authH(token: string, orgId: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": orgId };
}

interface Task {
  id: string; title: string; description?: string; status: TStatus;
  priority: string; assignedToId?: string; storyPoints?: number;
  estimatedHours?: number; actualHours?: number; dueDate?: string;
  tags: string[];
  project?: { id: string; name: string };
}

interface Sprint {
  id: string; name: string; goal?: string; status: string;
  startDate: string; endDate: string;
  project: { id: string; name: string };
}

function TaskCard({ task, onUpdate, employees }: { task: Task; onUpdate: (id: string, status: TStatus) => void; employees: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const assignee = employees.find(e => e.id === task.assignedToId);

  return (
    <div className="rounded-xl p-3 cursor-pointer"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-snug" style={{ color: "var(--text-primary)" }}>{task.title}</p>
        </div>
        {task.storyPoints && (
          <span style={{ fontSize: 9, background: "#1e1b4b", color: "#818cf8", padding: "2px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
            {task.storyPoints}pt
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "#0f172a", color: PRIORITY_COLOR[task.priority], fontWeight: 700 }}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span style={{ fontSize: 9, color: "var(--text-ghost)" }}>
            <Clock style={{ width: 9, height: 9, display: "inline", marginRight: 2 }} />
            {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        )}
        {task.tags?.map(t => (
          <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#0f172a", color: "#64748b" }}>{t}</span>
        ))}
        <div className="ml-auto">
          {assignee ? (
            <div title={assignee.name} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              {assignee.name.charAt(0)}
            </div>
          ) : (
            <User style={{ width: 13, height: 13, color: "var(--text-ghost)" }} />
          )}
        </div>
      </div>

      {expanded && task.status !== "DONE" && (
        <div className="mt-3 pt-3 flex flex-wrap gap-1" style={{ borderTop: "1px solid var(--border)" }}>
          {STATUSES.filter(s => s !== task.status).map(s => (
            <button key={s} onClick={e => { e.stopPropagation(); onUpdate(task.id, s); }}
              className="text-[10px] px-2 py-1 rounded-lg cursor-pointer"
              style={{ background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, border: "none" }}>
              → {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTaskModal({ sprintId, projectId, employees, onClose, onCreated }: {
  sprintId: string; projectId: string; employees: any[]; onClose: () => void; onCreated: () => void;
}) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM", assignedToId: "", storyPoints: "", estimatedHours: "", dueDate: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const f = (k: string) => (v: string) => setForm(p => ({
...p, [k]: v }));
  const inp = { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 6, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12 };

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const r = await fetch(`${API}/projects/tasks`, {
      method: "POST",
      headers: authH(token!, activeOrg!.id),
      body: JSON.stringify({
        title: form.title, description: form.description || undefined,
        priority: form.priority, sprintId, projectId,
        assignedToId: form.assignedToId || undefined,
        storyPoints: form.storyPoints ? Number(form.storyPoints) : undefined,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
        dueDate: form.dueDate || undefined,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      }),
    });
    setSaving(false);
    if (r.ok) { onCreated(); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>Add Task to Sprint</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Title *</label>
            <input style={inp} value={form.title} onChange={e => f("title")(e.target.value)} placeholder="Task title" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Priority</label>
              <select style={inp} value={form.priority} onChange={e => f("priority")(e.target.value)}>
                {["LOW","MEDIUM","HIGH","URGENT"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Assignee</label>
              <select style={inp} value={form.assignedToId} onChange={e => f("assignedToId")(e.target.value)}>
                <option value="">Unassigned</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Story Points</label>
              <input style={inp} type="number" value={form.storyPoints} onChange={e => f("storyPoints")(e.target.value)} placeholder="e.g. 3" />
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Est. Hours</label>
              <input style={inp} type="number" value={form.estimatedHours} onChange={e => f("estimatedHours")(e.target.value)} placeholder="e.g. 8" />
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Due Date</label>
              <input style={inp} type="date" value={form.dueDate} onChange={e => f("dueDate")(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Tags</label>
              <input style={inp} value={form.tags} onChange={e => f("tags")(e.target.value)} placeholder="ui, backend, bug" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Description</label>
            <textarea style={{ ...inp, resize: "vertical" } as React.CSSProperties} rows={2} value={form.description} onChange={e => f("description")(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 8, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none", cursor: "pointer", fontSize: 12 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: "7px 16px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {saving ? "Adding…" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SprintBoardPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [board, setBoard] = useState<Record<TStatus, Task[]>>({ TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] });
  const [boardStats, setBoardStats] = useState({ totalPoints: 0, donePoints: 0, totalTasks: 0 });
  const [employees, setEmployees] = useState<any[]>([]);
  const [selProjectId, setSelProjectId] = useState("");
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", startDate: "", endDate: "" });
  const h = () => authH(token!, activeOrg!.id);

  useEffect(() => {
    fetch(`${API}/it-projects`, { headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id } })
      .then(r => r.json()).then(d => { const ps = d.data ?? []; setProjects(ps); if (ps.length) setSelProjectId(ps[0].id); });
    fetch(`${API}/hr?status=ACTIVE`, { headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id } })
      .then(r => r.json()).then(d => setEmployees(d.data?.employees ?? []));
  }, [activeOrg?.id]);

  useEffect(() => {
    if (!selProjectId) return;
    fetch(`${API}/sprints?projectId=${selProjectId}`, { headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id } })
      .then(r => r.json()).then(d => {
        const sp = d.data ?? [];
        setSprints(sp);
        const active = sp.find((s: Sprint) => s.status === "ACTIVE") ?? sp[0];
        if (active) { setActiveSprint(active); loadBoard(active.id); }
      });
  }, [selProjectId]);

  async function loadBoard(sprintId: string) {
    const r = await fetch(`${API}/sprints/${sprintId}/board`, { headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id } });
    if (r.ok) {
      const d = await r.json();
      setBoard(d.data?.board ?? { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] });
      setBoardStats(d.data?.stats ?? { totalPoints: 0, donePoints: 0, totalTasks: 0 });
    }
  }

  async function updateTaskStatus(taskId: string, status: TStatus) {
    await fetch(`${API}/projects/tasks/${taskId}`, {
      method: "PATCH", headers: h(), body: JSON.stringify({ status }),
    });
    if (activeSprint) loadBoard(activeSprint.id);
  }

  async function createSprint() {
    if (!newSprint.name || !selProjectId) return;
    const r = await fetch(`${API}/sprints`, {
      method: "POST", headers: h(),
      body: JSON.stringify({ ...newSprint, projectId: selProjectId }),
    });
    if (r.ok) {
      const d = await r.json();
      setSprints(p => [d.data, ...p]);
      setActiveSprint(d.data);
      loadBoard(d.data.id);
      setShowCreateSprint(false);
      setNewSprint({ name: "", goal: "", startDate: "", endDate: "" });
    }
  }

  async function startSprint(sprintId: string) {
    await fetch(`${API}/sprints/${sprintId}`, {
      method: "PUT", headers: h(), body: JSON.stringify({ status: "ACTIVE" }),
    });
    setSprints(p => p.map(s => s.id === sprintId ? { ...s, status: "ACTIVE" } : s));
    if (activeSprint?.id === sprintId) setActiveSprint(s => s ? { ...s, status: "ACTIVE" } : s);
  }

  const inp = { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 6, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12 };
  const pct = boardStats.totalPoints ? Math.round((boardStats.donePoints / boardStats.totalPoints) * 100) : 0;

  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 60px)" }}>
      {/* Top bar */}
      <div className="p-4 flex-shrink-0 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
        <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_sprint_board') }</h1>

        <select value={selProjectId} onChange={e => setSelProjectId(e.target.value)} style={{ ...inp, minWidth: 160 }}>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <ChevronDown style={{ width: 12, height: 12, color: "var(--text-ghost)" }} />
          <select value={activeSprint?.id ?? ""} onChange={e => {
            const sp = sprints.find(s => s.id === e.target.value);
            if (sp) { setActiveSprint(sp); loadBoard(sp.id); }
          }} style={{ ...inp, minWidth: 140 }}>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
          </select>
        </div>

        {activeSprint && activeSprint.status === "PLANNED" && (
          <button onClick={() => startSprint(activeSprint.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#14532d", color: "#4ade80", border: "1px solid #166534", cursor: "pointer" }}>
            <Play style={{ width: 11, height: 11 }} /> Start Sprint
          </button>
        )}

        {activeSprint && (
          <button onClick={() => setShowAddTask(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white ml-auto"
            style={{ background: "#4f46e5", cursor: "pointer", border: "none" }}>
            <Plus style={{ width: 11, height: 11 }} /> Add Task
          </button>
        )}

        <button onClick={() => setShowCreateSprint(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}>
          + New Sprint
        </button>
      </div>

      {/* Sprint info + velocity */}
      {activeSprint && (
        <div className="px-4 py-2 flex-shrink-0 flex items-center gap-4 flex-wrap text-xs" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }}>
          <div className="flex items-center gap-1">
            <span style={{ color: "var(--text-ghost)" }}>Sprint:</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{activeSprint.name}</span>
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: activeSprint.status === "ACTIVE" ? "#14532d" : "#1e1b4b", color: activeSprint.status === "ACTIVE" ? "#4ade80" : "#818cf8", fontWeight: 700 }}>
              {activeSprint.status}
            </span>
          </div>
          {activeSprint.goal && <span style={{ color: "var(--text-ghost)" }}>Goal: {activeSprint.goal}</span>}
          <span style={{ color: "var(--text-ghost)" }}>
            {new Date(activeSprint.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} →
            {new Date(activeSprint.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
          {boardStats.totalPoints > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Timer style={{ width: 11, height: 11, color: "#818cf8" }} />
              <span style={{ color: "var(--text-secondary)" }}>{boardStats.donePoints}/{boardStats.totalPoints} pts ({pct}%)</span>
              <div style={{ width: 80, background: "#1e1b4b", borderRadius: 99, height: 4 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "#6366f1", borderRadius: 99 }} />
              </div>
            </div>
          )}
          <span style={{ color: "var(--text-ghost)" }}>{boardStats.totalTasks} tasks total</span>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex-1 p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-[900px] h-full">
          {STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status];
            const col = board[status] ?? [];
            return (
              <div key={status} className="flex flex-col rounded-xl overflow-hidden flex-1"
                style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", minWidth: 220 }}>
                {/* Column header */}
                <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: cfg.bg }}>
                  <div className="flex items-center gap-2">
                    {status === "DONE" && <CheckCircle style={{ width: 12, height: 12, color: cfg.color }} />}
                    {status === "IN_PROGRESS" && <Play style={{ width: 12, height: 12, color: cfg.color }} />}
                    <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize: 10, background: "rgba(0,0,0,0.3)", color: cfg.color, padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>{col.length}</span>
                </div>
                {/* Tasks */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {col.map(task => (
                    <TaskCard key={task.id} task={task} onUpdate={updateTaskStatus} employees={employees} />
                  ))}
                  {col.length === 0 && (
                    <p className="text-center text-xs py-8" style={{ color: "var(--text-ghost)" }}>No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Sprint modal */}
      {showCreateSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded-2xl p-5 w-full max-w-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>New Sprint</h2>
            <div className="space-y-3">
              {[["Sprint Name","name","text","e.g. Sprint 1"],["Sprint Goal","goal","text","Optional goal"],["Start Date","startDate","date",""],["End Date","endDate","date",""]].map(([l,k,t,ph]) => (
                <div key={String(k)}>
                  <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>{l}</label>
                  <input style={{ ...inp, width: "100%" }} type={String(t)} placeholder={String(ph)}
                    value={(newSprint as any)[k as string]} onChange={e => setNewSprint(p => ({ ...p, [k as string]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCreateSprint(false)} style={{ padding: "7px 14px", borderRadius: 8, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none", cursor: "pointer", fontSize: 12 }}>Cancel</button>
              <button onClick={createSprint} style={{ padding: "7px 16px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showAddTask && activeSprint && (
        <CreateTaskModal
          sprintId={activeSprint.id}
          projectId={selProjectId}
          employees={employees}
          onClose={() => setShowAddTask(false)}
          onCreated={() => loadBoard(activeSprint.id)}
        />
      )}
    </div>
  );
}
