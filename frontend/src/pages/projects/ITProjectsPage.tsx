import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Users, Calendar, GitBranch, ExternalLink, ChevronRight, Target, Code2, Briefcase, Search, Filter, Share2, Copy, Check, Trash2 } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

const PROJECT_TYPES: Record<string, string> = {
  WEB_APP: "Web App", MOBILE_APP: "Mobile App", API_SERVICE: "API / Service",
  DESKTOP_APP: "Desktop App", DATA_ANALYTICS: "Data Analytics", AI_ML: "AI / ML",
  DEVOPS_INFRA: "DevOps / Infra", ECOMMERCE: "E-Commerce", ERP_CRM: "ERP / CRM",
  CONSULTING: "Consulting", OTHER: "Other",
};

const ROLES: Record<string, string> = {
  PROJECT_MANAGER: "Project Manager", PROJECT_INCHARGE: "Project Incharge",
  TECH_LEAD: "Tech Lead", SENIOR_DEVELOPER: "Senior Dev", DEVELOPER: "Developer",
  FRONTEND_DEV: "Frontend Dev", BACKEND_DEV: "Backend Dev", FULLSTACK_DEV: "Fullstack Dev",
  UI_UX_DESIGNER: "UI/UX Designer", QA_ENGINEER: "QA Engineer", DEVOPS_ENGINEER: "DevOps",
  BUSINESS_ANALYST: "Business Analyst", SCRUM_MASTER: "Scrum Master", STAKEHOLDER: "Stakeholder",
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PLANNING:  { bg: "#1e3a5f", color: "#60a5fa" },
  ACTIVE:    { bg: "#14532d", color: "#4ade80" },
  ON_HOLD:   { bg: "#78350f", color: "#fbbf24" },
  COMPLETED: { bg: "#1e1b4b", color: "#818cf8" },
  CANCELLED: { bg: "#450a0a", color: "#f87171" },
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#60a5fa", MEDIUM: "#fbbf24", HIGH: "#f97316", URGENT: "#f87171",
};

function authH(token: string, orgId: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": orgId };
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#4ade80" : pct >= 40 ? "#fbbf24" : "#6366f1";
  return (
    <div style={{ background: "#1e1b4b", borderRadius: 99, height: 5, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isLead = ["PROJECT_MANAGER","PROJECT_INCHARGE","TECH_LEAD","SCRUM_MASTER"].includes(role);
  return (
    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: isLead ? "#312e81" : "#1e293b", color: isLead ? "#c7d2fe" : "#94a3b8", fontWeight: 600 }}>
      {ROLES[role] ?? role}
    </span>
  );
}

interface Member { id: string; role: string; employee: { id: string; name: string; designation?: string } }
interface Project {
  id: string; name: string; description?: string; status: string; projectType: string;
  priority: string; clientName?: string; techStack: string[]; repoUrl?: string;
  liveUrl?: string; startDate?: string; endDate?: string; completionPct: number;
  publicToken?: string | null;
  members: Member[]; _count: { tasks: number; sprints: number };
  taskStats: { total: number; done: number; pct: number };
}

function CreateProjectModal({ employees, onClose, onCreated }: { employees: any[]; onClose: () => void; onCreated: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [form, setForm] = useState({
    name: "", projectType: "WEB_APP", priority: "MEDIUM", status: "PLANNING",
    clientName: "", startDate: "", endDate: "", budget: "", totalEstHours: "",
    techStack: "", repoUrl: "", description: "",
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string) => (v: string) => setForm(p => ({
...p, [k]: v }));

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const r = await fetch(`${API}/it-projects`, {
      method: "POST",
      headers: authH(token!, activeOrg!.id),
      body: JSON.stringify({ ...form }),
    });
    setSaving(false);
    if (r.ok) { onCreated(); onClose(); }
  }

  const inp = { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13 };
  const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h2 className="text-base font-bold mb-5" style={{ color: "var(--text-primary)" }}>New IT Project</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label style={lbl}>Project Name *</label>
            <input style={inp} value={form.name} onChange={e => f("name")(e.target.value)} placeholder="e.g. Customer Portal v2" />
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select style={inp} value={form.projectType} onChange={e => f("projectType")(e.target.value)}>
              {Object.entries(PROJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Priority</label>
            <select style={inp} value={form.priority} onChange={e => f("priority")(e.target.value)}>
              {["LOW","MEDIUM","HIGH","URGENT"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Client / Company</label>
            <input style={inp} value={form.clientName} onChange={e => f("clientName")(e.target.value)} placeholder="Client name" />
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.status} onChange={e => f("status")(e.target.value)}>
              {["PLANNING","ACTIVE","ON_HOLD","COMPLETED"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Start Date</label>
            <input style={inp} type="date" value={form.startDate} onChange={e => f("startDate")(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>End Date</label>
            <input style={inp} type="date" value={form.endDate} onChange={e => f("endDate")(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Est. Budget (₹)</label>
            <input style={inp} type="number" value={form.budget} onChange={e => f("budget")(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Est. Hours</label>
            <input style={inp} type="number" value={form.totalEstHours} onChange={e => f("totalEstHours")(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Tech Stack (comma-separated)</label>
            <input style={inp} value={form.techStack} onChange={e => f("techStack")(e.target.value)} placeholder="React, Node.js, PostgreSQL" />
          </div>
          <div>
            <label style={lbl}>Repository URL</label>
            <input style={inp} value={form.repoUrl} onChange={e => f("repoUrl")(e.target.value)} placeholder="https://github.com/..." />
          </div>
          <div className="col-span-2">
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, resize: "vertical" } as React.CSSProperties} rows={2} value={form.description} onChange={e => f("description")(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none", cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: "8px 20px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {saving ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const sc = STATUS_COLOR[project.status] ?? STATUS_COLOR.PLANNING;
  const leads = project.members.filter(m => ["PROJECT_MANAGER","PROJECT_INCHARGE","TECH_LEAD"].includes(m.role));

  return (
    <div onClick={onClick} className="rounded-xl p-5 cursor-pointer transition-all"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#4f46e5")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{project.name}</span>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: sc.bg, color: sc.color, fontWeight: 700, flexShrink: 0 }}>
              {project.status}
            </span>
            <span style={{ fontSize: 10, color: PRIORITY_COLOR[project.priority], fontWeight: 700 }}>
              {project.priority}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, background: "#1e1b4b", color: "#a5b4fc", padding: "2px 8px", borderRadius: 99 }}>
              {PROJECT_TYPES[project.projectType] ?? project.projectType}
            </span>
            {project.clientName && <span className="text-xs" style={{ color: "var(--text-ghost)" }}>{project.clientName}</span>}
          </div>
        </div>
        <ChevronRight style={{ width: 14, height: 14, color: "var(--text-ghost)", flexShrink: 0 }} />
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "var(--text-ghost)" }}>{project.taskStats.done}/{project.taskStats.total} tasks</span>
          <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{project.taskStats.pct}%</span>
        </div>
        <ProgressBar pct={project.taskStats.pct} />
      </div>

      {/* Tech stack */}
      {project.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {project.techStack.slice(0, 5).map(t => (
            <span key={t} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#0f172a", color: "#64748b", border: "1px solid #1e293b" }}>{t}</span>
          ))}
          {project.techStack.length > 5 && <span style={{ fontSize: 9, color: "var(--text-ghost)" }}>+{project.techStack.length - 5}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {leads.slice(0, 3).map(m => (
            <div key={m.id} title={`${m.employee.name} (${ROLES[m.role]})`}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "2px solid var(--bg-card)" }}>
              {m.employee.name.charAt(0)}
            </div>
          ))}
          {project.members.length > 3 && (
            <span className="text-xs ml-1" style={{ color: "var(--text-ghost)" }}>+{project.members.length - 3}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
            <GitBranch style={{ width: 11, height: 11, display: "inline", marginRight: 3 }} />{project._count.sprints} sprints
          </span>
          {project.endDate && (
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
              <Calendar style={{ width: 11, height: 11, display: "inline", marginRight: 3 }} />
              {new Date(project.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectDetailPanel({ project, onClose, onRefresh }: { project: Project; onClose: () => void; onRefresh: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [employees, setEmployees] = useState<any[]>([]);
  const [addMemberEmpId, setAddMemberEmpId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("DEVELOPER");
  const [msTitle, setMsTitle] = useState(""); const [msDue, setMsDue] = useState("");
  const [shareToken, setShareToken] = useState<string | null>(project.publicToken ?? null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const h = () => authH(token!, activeOrg!.id);

  const publicUrl = shareToken ? `${window.location.origin}/public/project/${shareToken}` : null;

  async function generateLink() {
    setShareLoading(true);
    try {
      const r = await fetch(`${API}/it-projects/${project.id}/share`, { method: "POST", headers: h() });
      const d = await r.json();
      if (d.success) { setShareToken(d.data.token); onRefresh(); }
    } finally { setShareLoading(false); }
  }

  async function revokeLink() {
    if (!confirm("Revoke public link? Anyone with the current link will lose access.")) return;
    setShareLoading(true);
    try {
      await fetch(`${API}/it-projects/${project.id}/share`, { method: "DELETE", headers: h() });
      setShareToken(null); onRefresh();
    } finally { setShareLoading(false); }
  }

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  useEffect(() => {
    fetch(`${API}/hr?status=ACTIVE`, { headers: h() })
      .then(r => r.json()).then(d => setEmployees(d.data?.employees ?? []));
  }, []);

  async function addMember() {
    if (!addMemberEmpId) return;
    await fetch(`${API}/it-projects/${project.id}/members`, {
      method: "POST", headers: h(), body: JSON.stringify({ employeeId: addMemberEmpId, role: addMemberRole }),
    });
    setAddMemberEmpId(""); onRefresh();
  }

  async function removeMember(memberId: string) {
    await fetch(`${API}/it-projects/${project.id}/members/${memberId}`, { method: "DELETE", headers: h() });
    onRefresh();
  }

  async function addMilestone() {
    if (!msTitle || !msDue) return;
    await fetch(`${API}/it-projects/${project.id}/milestones`, {
      method: "POST", headers: h(), body: JSON.stringify({ title: msTitle, dueDate: msDue }),
    });
    setMsTitle(""); setMsDue(""); onRefresh();
  }

  async function toggleMilestone(msId: string, done: boolean) {
    await fetch(`${API}/it-projects/${project.id}/milestones/${msId}`, {
      method: "PATCH", headers: h(),
      body: JSON.stringify({ completedAt: done ? new Date().toISOString() : null }),
    });
    onRefresh();
  }

  const inp = { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 6, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12 };
  const sc = STATUS_COLOR[project.status] ?? STATUS_COLOR.PLANNING;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="h-full md:h-auto md:max-h-[92vh] overflow-y-auto w-full md:w-[520px] rounded-t-2xl md:rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{project.name}</h2>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: sc.bg, color: sc.color, fontWeight: 700 }}>{project.status}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span style={{ fontSize: 11, color: "#a5b4fc" }}>{PROJECT_TYPES[project.projectType]}</span>
              {project.clientName && <span className="text-xs" style={{ color: "var(--text-ghost)" }}>· {project.clientName}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-ghost)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>

        {/* ── Public share link ── */}
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: shareToken ? "#0f1f0f" : "var(--bg-hover)", border: `1px solid ${shareToken ? "#22c55e44" : "var(--border)"}` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Share2 style={{ width: 13, height: 13, color: shareToken ? "#22c55e" : "#6b7280" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: shareToken ? "#22c55e" : "var(--text-secondary)" }}>
                {shareToken ? "Public link active" : "Share with client (no login needed)"}
              </span>
            </div>
            {shareToken
              ? <button onClick={revokeLink} disabled={shareLoading} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", padding: 0 }} title="Revoke link">
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              : <button onClick={generateLink} disabled={shareLoading} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#6366f1", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  {shareLoading ? "…" : "Generate link"}
                </button>
            }
          </div>
          {shareToken && publicUrl && (
            <div className="flex items-center gap-2">
              <input readOnly value={publicUrl} style={{ flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 6, background: "#0a140a", border: "1px solid #22c55e33", color: "#86efac", outline: "none" }} />
              <button onClick={copyLink} style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 6, background: shareCopied ? "#22c55e" : "#1e3a1e", border: "none", cursor: "pointer", color: shareCopied ? "#fff" : "#4ade80", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                {shareCopied ? <Check style={{ width: 11, height: 11 }} /> : <Copy style={{ width: 11, height: 11 }} />}
                {shareCopied ? "Copied" : "Copy"}
              </button>
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 6, background: "#1e3a1e", border: "none", color: "#4ade80", fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink style={{ width: 11, height: 11 }} /> Preview
              </a>
            </div>
          )}
        </div>

        {/* Tech stack */}
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <Code2 style={{ width: 12, height: 12, color: "#64748b", marginTop: 3, flexShrink: 0 }} />
            {project.techStack.map(t => (
              <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#0f172a", color: "#64748b", border: "1px solid #1e293b" }}>{t}</span>
            ))}
          </div>
        )}

        {/* Links */}
        <div className="flex gap-3 mb-4">
          {project.repoUrl && (
            <a href={project.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs" style={{ color: "#818cf8" }}>
              <GitBranch style={{ width: 11, height: 11 }} /> Repository
            </a>
          )}
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs" style={{ color: "#4ade80" }}>
              <ExternalLink style={{ width: 11, height: 11 }} /> Live
            </a>
          )}
        </div>

        {/* Progress */}
        <div className="rounded-xl p-3 mb-4" style={{ background: "var(--bg-hover)" }}>
          <div className="flex justify-between text-xs mb-2">
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Progress</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{project.taskStats.pct}%</span>
          </div>
          <ProgressBar pct={project.taskStats.pct} />
          <div className="flex gap-4 mt-2">
            {[["Total", project.taskStats.total, "#94a3b8"],["Done", project.taskStats.done, "#4ade80"],["Open", project.taskStats.total - project.taskStats.done, "#fbbf24"]].map(([l, v, c]) => (
              <div key={String(l)}>
                <p style={{ fontSize: 16, fontWeight: 700, color: String(c) }}>{v}</p>
                <p style={{ fontSize: 10, color: "var(--text-ghost)" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="mb-4">
          <p className="text-xs font-bold mb-2" style={{ color: "var(--text-secondary)" }}>Team ({project.members.length})</p>
          <div className="space-y-2 mb-3">
            {project.members.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--bg-hover)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                    {m.employee.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{m.employee.name}</p>
                    {m.employee.designation && <p style={{ fontSize: 10, color: "var(--text-ghost)" }}>{m.employee.designation}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge role={m.role} />
                  <button onClick={() => removeMember(m.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <select value={addMemberEmpId} onChange={e => setAddMemberEmpId(e.target.value)} style={{ ...inp, flex: 2 }}>
              <option value="">Select employee</option>
              {employees.filter(e => !project.members.find(m => m.employee.id === e.id)).map((e: any) => (
                <option key={e.id} value={e.id}>{e.name} {e.designation ? `(${e.designation})` : ""}</option>
              ))}
            </select>
            <select value={addMemberRole} onChange={e => setAddMemberRole(e.target.value)} style={{ ...inp, flex: 2 }}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={addMember} style={{ padding: "7px 14px", borderRadius: 6, background: "#4f46e5", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>+ Add</button>
          </div>
        </div>

        {/* Milestones */}
        <div>
          <p className="text-xs font-bold mb-2" style={{ color: "var(--text-secondary)" }}>Milestones</p>
          <div className="space-y-2 mb-3">
            {(project as any).milestones?.map((ms: any) => (
              <div key={ms.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--bg-hover)" }}>
                <input type="checkbox" checked={!!ms.completedAt} onChange={e => toggleMilestone(ms.id, e.target.checked)}
                  style={{ accentColor: "#4ade80" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: ms.completedAt ? "var(--text-ghost)" : "var(--text-primary)", textDecoration: ms.completedAt ? "line-through" : "none" }}>
                    {ms.title}
                  </p>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-ghost)", flexShrink: 0 }}>
                  {new Date(ms.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input style={{ ...inp, flex: 3 }} value={msTitle} onChange={e => setMsTitle(e.target.value)} placeholder="Milestone title" />
            <input style={{ ...inp, flex: 2 }} type="date" value={msDue} onChange={e => setMsDue(e.target.value)} />
            <button onClick={addMilestone} style={{ padding: "7px 14px", borderRadius: 6, background: "#0f172a", color: "#818cf8", border: "1px solid #312e81", cursor: "pointer", fontSize: 12 }}>+ Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ITProjectsPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (search) params.set("search", search);
    const r = await fetch(`${API}/it-projects?${params}`, {
      headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id },
    });
    if (r.ok) { const d = await r.json(); setProjects(d.data ?? []); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeOrg?.id, statusFilter, typeFilter]);
  useEffect(() => {
    if (search.length === 0 || search.length > 2) load();
  }, [search]);

  useEffect(() => {
    fetch(`${API}/hr?status=ACTIVE`, {
      headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id },
    }).then(r => r.json()).then(d => setEmployees(d.data?.employees ?? []));
  }, [activeOrg?.id]);

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === "ACTIVE").length,
    completed: projects.filter(p => p.status === "COMPLETED").length,
    onHold: projects.filter(p => p.status === "ON_HOLD").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_it_projects') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {stats.active} active · {stats.completed} completed · {stats.onHold} on hold
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <Plus style={{ width: 14, height: 14 }} /> New Project
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, icon: Briefcase, color: "#818cf8" },
          { label: "Active", value: stats.active, icon: Code2, color: "#4ade80" },
          { label: "Completed", value: stats.completed, icon: Target, color: "#a78bfa" },
          { label: "On Hold", value: stats.onHold, icon: Filter, color: "#fbbf24" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon style={{ width: 14, height: 14, color }} />
              <p className="text-xs" style={{ color: "var(--text-ghost)" }}>{label}</p>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48 rounded-xl px-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Search style={{ width: 13, height: 13, color: "var(--text-ghost)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
            className="text-sm py-2 flex-1 bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="ALL">All Status</option>
          {["PLANNING","ACTIVE","ON_HOLD","COMPLETED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="ALL">All Types</option>
          {Object.entries(PROJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <Code2 style={{ width: 48, height: 48, color: "var(--text-ghost)", margin: "0 auto 12px" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No projects found</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#4f46e5" }}>
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} />)}
        </div>
      )}

      {showCreate && <CreateProjectModal employees={employees} onClose={() => setShowCreate(false)} onCreated={load} />}
      {selected && <ProjectDetailPanel project={selected} onClose={() => setSelected(null)} onRefresh={() => { load(); setSelected(null); }} />}
    </div>
  );
}
