import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { CheckCircle, Clock, AlertCircle, Plus, Timer, ListTodo } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

const STATUS_CFG = {
  TODO:        { label: "To Do",      bg: "#1e293b", color: "#94a3b8" },
  IN_PROGRESS: { label: "In Progress",bg: "#451a03", color: "#fbbf24" },
  IN_REVIEW:   { label: "In Review",  bg: "#1e1b4b", color: "#a78bfa" },
  DONE:        { label: "Done",       bg: "#14532d", color: "#4ade80" },
};
type TStatus = keyof typeof STATUS_CFG;

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#60a5fa", MEDIUM: "#fbbf24", HIGH: "#f97316", URGENT: "#f87171",
};

function authH(token: string, orgId: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": orgId };
}

interface Task {
  id: string; title: string; description?: string; status: TStatus;
  priority: string; storyPoints?: number; estimatedHours?: number; actualHours?: number;
  dueDate?: string; tags: string[];
  project?: { id: string; name: string; projectType: string };
}

interface TimeLog {
  id: string; hours: number; notes?: string; logDate: string;
  task: { id: string; title: string };
}

function LogTimeModal({ taskId, employeeId, onClose, onLogged }: { taskId: string; employeeId: string; onClose: () => void; onLogged: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!hours) return;
    setSaving(true);
    await fetch(`${API}/sprints/log-time`, {
      method: "POST",
      headers: authH(token!, activeOrg!.id),
      body: JSON.stringify({ taskId, employeeId, hours: Number(hours), notes: notes || undefined }),
    });
    setSaving(false);
    onLogged(); onClose();
  }

  const inp = { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 6, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12 };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          <Timer style={{ width: 14, height: 14, display: "inline", marginRight: 6, color: "#818cf8" }} />Log Time
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Hours *</label>
            <input style={inp} type="number" step="0.5" min="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 2.5" />
          </div>
          <div>
            <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-secondary)" }}>Notes</label>
            <textarea style={{ ...inp, resize: "vertical" } as React.CSSProperties} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What did you work on?" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 8, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none", cursor: "pointer", fontSize: 12 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: "7px 16px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {saving ? "Logging…" : "Log Time"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onStatusChange, onLogTime }: { task: Task; onStatusChange: (id: string, s: TStatus) => void; onLogTime: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CFG[task.status];
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: `1px solid ${overdue ? "#7f1d1d" : "var(--border)"}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>{task.title}</p>
          {task.project && (
            <p style={{ fontSize: 10, color: "#818cf8", marginTop: 2 }}>{task.project.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
          {task.storyPoints && <span style={{ fontSize: 9, background: "#1e1b4b", color: "#818cf8", padding: "2px 5px", borderRadius: 4 }}>{task.storyPoints}pt</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs flex-wrap mb-2">
        <span style={{ color: PRIORITY_COLOR[task.priority], fontWeight: 700 }}>◆ {task.priority}</span>
        {task.dueDate && (
          <span style={{ color: overdue ? "#f87171" : "var(--text-ghost)" }}>
            <Clock style={{ width: 10, height: 10, display: "inline", marginRight: 2 }} />
            {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {overdue && " (Overdue!)"}
          </span>
        )}
        {(task.estimatedHours || task.actualHours) && (
          <span style={{ color: "var(--text-ghost)" }}>
            <Timer style={{ width: 10, height: 10, display: "inline", marginRight: 2 }} />
            {task.actualHours ?? 0}h / {task.estimatedHours ?? "—"}h est.
          </span>
        )}
      </div>

      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map(t => <span key={t} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: "#0f172a", color: "#64748b" }}>{t}</span>)}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        {Object.entries(STATUS_CFG).filter(([s]) => s !== task.status).map(([s, c]) => (
          <button key={s} onClick={() => onStatusChange(task.id, s as TStatus)}
            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: c.bg, color: c.color, border: "none", cursor: "pointer" }}>
            → {c.label}
          </button>
        ))}
        <button onClick={() => onLogTime(task.id)}
          className="ml-auto flex items-center gap-1"
          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "#1e1b4b", color: "#818cf8", border: "1px solid #312e81", cursor: "pointer" }}>
          <Timer style={{ width: 9, height: 9 }} /> Log Time
        </button>
      </div>
    </div>
  );
}

export default function MyWorkPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selEmpId, setSelEmpId] = useState("");
  const [board, setBoard] = useState<Record<TStatus, Task[]>>({ TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] });
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [logTaskId, setLogTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"board" | "list" | "time">("board");

  const h = () => authH(token!, activeOrg!.id);

  useEffect(() => {
    fetch(`${API}/hr?status=ACTIVE`, { headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id } })
      .then(r => r.json()).then(d => { const emps = d.data?.employees ?? []; setEmployees(emps); if (emps.length) setSelEmpId(emps[0].id); });
  }, [activeOrg?.id]);

  useEffect(() => { if (selEmpId) load(); }, [selEmpId]);

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/it-projects/my-work?employeeId=${selEmpId}`, { headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id } });
    if (r.ok) {
      const d = await r.json();
      setBoard(d.data?.board ?? { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] });
      setTimeLogs(d.data?.timeLogs ?? []);
    }
    setLoading(false);
  }

  async function updateStatus(taskId: string, status: TStatus) {
    await fetch(`${API}/projects/tasks/${taskId}`, {
      method: "PATCH", headers: h(), body: JSON.stringify({ status }),
    });
    load();
  }

  const allTasks = Object.values(board).flat();
  const totalHoursLogged = timeLogs.reduce((s, l) => s + l.hours, 0);
  const selEmp = employees.find(e => e.id === selEmpId);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_my_work') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Task board &amp; time tracking per employee</p>
        </div>
        <select value={selEmpId} onChange={e => setSelEmpId(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", minWidth: 180 }}>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {/* Summary */}
      {selEmp && (
        <div className="rounded-xl p-4 mb-5 flex items-center gap-4 flex-wrap" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>{selEmp.name.charAt(0)}</div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{selEmp.name}</p>
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>{selEmp.designation ?? "—"} · {selEmp.department ?? "—"}</p>
          </div>
          {[
            ["Open", board.TODO.length + board.IN_PROGRESS.length + board.IN_REVIEW.length, "#fbbf24"],
            ["Done", board.DONE.length, "#4ade80"],
            ["Total", allTasks.length, "#818cf8"],
            ["Hours Logged", totalHoursLogged.toFixed(1) + "h", "#a78bfa"],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="text-center px-4" style={{ borderLeft: "1px solid var(--border)" }}>
              <p className="text-lg font-bold" style={{ color: String(c) }}>{v}</p>
              <p style={{ fontSize: 10, color: "var(--text-ghost)" }}>{l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([["board", "Board"], ["list", "List"], ["time", "Time Logs"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: activeTab === k ? "#4f46e5" : "var(--bg-hover)", color: activeTab === k ? "#fff" : "var(--text-secondary)" }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      ) : activeTab === "board" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(STATUS_CFG) as [TStatus, typeof STATUS_CFG[TStatus]][]).map(([status, cfg]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                <span style={{ fontSize: 10, background: cfg.bg, color: cfg.color, padding: "1px 6px", borderRadius: 99, marginLeft: "auto" }}>{board[status]?.length ?? 0}</span>
              </div>
              <div className="space-y-3">
                {(board[status] ?? []).map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={updateStatus} onLogTime={id => setLogTaskId(id)} />
                ))}
                {(board[status] ?? []).length === 0 && (
                  <p className="text-center text-xs py-6" style={{ color: "var(--text-ghost)" }}>Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "list" ? (
        <div className="space-y-2">
          {allTasks.length === 0 ? (
            <div className="text-center py-16">
              <ListTodo style={{ width: 40, height: 40, color: "var(--text-ghost)", margin: "0 auto 12px" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No tasks assigned</p>
            </div>
          ) : allTasks.map(t => <TaskCard key={t.id} task={t} onStatusChange={updateStatus} onLogTime={id => setLogTaskId(id)} />)}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {timeLogs.length === 0 ? (
            <div className="text-center py-12">
              <Timer style={{ width: 32, height: 32, color: "var(--text-ghost)", margin: "0 auto 8px" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No time logs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {["Task", "Hours", "Date", "Notes"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold" style={{ color: "var(--text-ghost)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((log, i) => (
                  <tr key={log.id} style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--text-primary)" }}>{log.task.title}</td>
                    <td className="px-4 py-2">
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>{log.hours}h</span>
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--text-ghost)" }}>
                      {new Date(log.logDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--text-ghost)" }}>{log.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {logTaskId && selEmpId && (
        <LogTimeModal taskId={logTaskId} employeeId={selEmpId} onClose={() => setLogTaskId(null)} onLogged={load} />
      )}
    </div>
  );
}
