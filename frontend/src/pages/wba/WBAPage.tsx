import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ShieldCheck, Users, Calendar, Building2, X, ArrowRight, Sparkles, UserPlus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { formatDate } from "@/lib/utils";

// ── Access level, fetched from the backend (not derived from the generic
// platform role) — see wba.controller.ts for why. OWNER = the org owner,
// full control incl. staffing. PM = runs status/deadlines, can't staff.
// LEADERSHIP = read-only visibility everywhere. STAFF = sees only their own.
type WBALevel = "OWNER" | "PM" | "LEADERSHIP" | "STAFF";
const CAN_SEE_ALL: WBALevel[] = ["OWNER", "PM", "LEADERSHIP"];
const CAN_WRITE: WBALevel[] = ["OWNER", "PM"];

// ── Reference data — the exact categories & statuses given for the
// White Band Associate service-delivery pipeline. ──────────────────
export const WBA_CATEGORIES: Record<string, string> = {
  VAPT: "VAPT",
  GRC: "GRC",
  SOC: "SOC",
  DIGITAL_FORENSICS: "Digital Forensics",
  AWARENESS_TRAINING: "Awareness Training",
  COACHING: "Coaching",
};

export const WBA_STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  NOT_STARTED: { label: "Not Started", color: "#94a3b8", bg: "#1e293b" },
  STARTED: { label: "Started", color: "#60a5fa", bg: "#1e3a5f" },
  ABOUT_TO_COMPLETE: { label: "About to complete", color: "#fbbf24", bg: "#451a03" },
  AWAITING_CLIENT_CONFIRMATION: { label: "Completed — awaiting client confirmation", color: "#f97316", bg: "#431407" },
  COMPLETED: { label: "Completed", color: "#4ade80", bg: "#14532d" },
};

interface Employee { id: string; name: string; designation?: string; }
interface WBAMember { id: string; employeeDeadline?: string | null; employee: { id: string; name: string; designation?: string; userId?: string | null } }
interface WBAProject {
  id: string; projectName: string; clientName: string; description?: string;
  category: string; status: string; resources?: string; clientDeadline?: string | null;
  quotation?: { id: string; quotationNumber: string } | null;
  createdBy?: { id: string; name: string } | null;
  members: WBAMember[];
  myDeadline?: string | null;
  createdAt: string;
}
interface Opportunity {
  id: string; quotationNumber: string; subject?: string | null; total: number;
  party?: { id: string; name: string } | null;
}

// ── Add / Convert Project form — reused for both a fresh project and
// converting an accepted quotation into one. ────────────────────────
export function WBAProjectFormModal({
  opportunity, isOwner, onClose, onSaved,
}: { opportunity?: Opportunity | null; isOwner: boolean; onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projectName, setProjectName] = useState(opportunity ? (opportunity.subject || `${opportunity.party?.name ?? "Client"} — ${opportunity.quotationNumber}`) : "");
  const [clientName, setClientName] = useState(opportunity?.party?.name || "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("VAPT");
  const [resources, setResources] = useState("");
  const [clientDeadline, setClientDeadline] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({}); // employeeId -> deadline
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOwner) return; // only the org owner staffs a project
    api.get("/hr", { params: { limit: 200 } })
      .then(r => setEmployees(r.data.data?.employees || []))
      .catch(() => setEmployees([]));
  }, [isOwner]);

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => {
      const next = { ...prev };
      if (id in next) delete next[id]; else next[id] = "";
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!projectName.trim() || !clientName.trim()) { setError("Project name and client name are required."); return; }
    setSaving(true);
    setError("");
    const members = Object.entries(selectedMembers).map(([employeeId, employeeDeadline]) => ({
      employeeId, employeeDeadline: employeeDeadline || undefined,
    }));
    try {
      if (opportunity) {
        await api.post(`/wba/opportunities/${opportunity.id}/convert`, {
          category, resources: resources || undefined,
          clientDeadline: clientDeadline || undefined, members,
        });
      } else {
        await api.post("/wba/projects", {
          projectName, clientName, description: description || undefined,
          category, resources: resources || undefined,
          clientDeadline: clientDeadline || undefined, members,
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save the project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              {opportunity ? "Start project from quotation" : "New Project"}
            </h3>
            {opportunity && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>From quotation {opportunity.quotationNumber}</p>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div style={{ background: "#450a0a", color: "#f87171", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

          <Field label="Project Name">
            <input value={projectName} disabled={!!opportunity} onChange={e => setProjectName(e.target.value)} style={inputStyle} placeholder="e.g. Acme Corp — VAPT Engagement" />
          </Field>
          <Field label="Client Name">
            <input value={clientName} disabled={!!opportunity} onChange={e => setClientName(e.target.value)} style={inputStyle} placeholder="Client / company name" />
          </Field>
          {!opportunity && (
            <Field label="Description">
              <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="What's the scope of this engagement?" />
            </Field>
          )}
          <Field label="Category">
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {Object.entries(WBA_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>

          {isOwner && (
            <Field label="Assign employees">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {employees.map(emp => {
                  const active = emp.id in selectedMembers;
                  return (
                    <button type="button" key={emp.id} onClick={() => toggleMember(emp.id)}
                      style={{
                        padding: "6px 11px", borderRadius: 8, fontSize: 12.5, cursor: "pointer",
                        border: active ? "1px solid #2FB8A6" : "1px solid var(--border)",
                        background: active ? "rgba(47,184,166,0.12)" : "var(--bg-hover)",
                        color: active ? "#2FB8A6" : "var(--text-sec)",
                      }}>
                      {emp.name}{emp.designation ? ` · ${emp.designation}` : ""}
                    </button>
                  );
                })}
                {employees.length === 0 && <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>No employees found yet.</span>}
              </div>
              {Object.keys(selectedMembers).length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.keys(selectedMembers).map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    return (
                      <div key={empId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12.5, color: "var(--text-sec)", minWidth: 120 }}>{emp?.name} deadline</span>
                        <input type="date" value={selectedMembers[empId]} onChange={e => setSelectedMembers(prev => ({ ...prev, [empId]: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Field>
          )}
          {!isOwner && (
            <p style={{ fontSize: 12, color: "var(--text-ghost)", margin: 0 }}>
              Staffing the project is the org owner's call — they'll assign the team once this is created.
            </p>
          )}

          <Field label="Resources">
            <input value={resources} onChange={e => setResources(e.target.value)} style={inputStyle} placeholder="Tools, licenses, budget notes..." />
          </Field>
          <Field label="Deadline from client">
            <input type="date" value={clientDeadline} onChange={e => setClientDeadline(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-sec)", cursor: "pointer", fontSize: 13.5 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#2FB8A6", color: "#06231f", fontWeight: 700, cursor: saving ? "default" : "pointer", fontSize: 13.5, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : opportunity ? "Create project" : "Add Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--text-sec)", fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 8,
  padding: "9px 11px", color: "var(--text-primary)", fontSize: 13.5, outline: "none", boxSizing: "border-box",
  fontWeight: 400,
};

// ── Status control ───────────────────────────────────────────────
function StatusSelect({ project, onChanged, editable }: { project: WBAProject; onChanged: () => void; editable: boolean }) {
  const cfg = WBA_STATUSES[project.status] || WBA_STATUSES.NOT_STARTED;
  const [busy, setBusy] = useState(false);

  if (!editable) {
    return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
  }

  const handleChange = async (status: string) => {
    setBusy(true);
    try { await api.put(`/wba/projects/${project.id}`, { status }); onChanged(); } finally { setBusy(false); }
  };

  return (
    <select value={project.status} disabled={busy} onChange={e => handleChange(e.target.value)}
      style={{
        WebkitAppearance: "none", MozAppearance: "none", appearance: "none",
        fontSize: 11, fontWeight: 700, padding: "3px 22px 3px 9px", borderRadius: 99, background: cfg.bg, color: cfg.color,
        border: "none", cursor: busy ? "default" : "pointer", maxWidth: 200,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${encodeURIComponent(cfg.color)}' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
      }}>
      {Object.entries(WBA_STATUSES).map(([k, v]) => <option key={k} value={k} style={{ color: "#000" }}>{v.label}</option>)}
    </select>
  );
}

// ── Assign team — staffing an existing project is the org owner's job alone ──
function AssignTeamModal({ project, onClose, onChanged }: { project: WBAProject; onClose: () => void; onChanged: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pickEmployeeId, setPickEmployeeId] = useState("");
  const [pickDeadline, setPickDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/hr", { params: { limit: 200 } }).then(r => setEmployees(r.data.data?.employees || [])).catch(() => setEmployees([]));
  }, []);

  const assignedIds = new Set(project.members.map(m => m.employee.id));
  const available = employees.filter(e => !assignedIds.has(e.id));

  const handleAdd = async () => {
    if (!pickEmployeeId) return;
    setBusy(true);
    try {
      await api.post(`/wba/projects/${project.id}/members`, { employeeId: pickEmployeeId, employeeDeadline: pickDeadline || undefined });
      setPickEmployeeId(""); setPickDeadline("");
      onChanged();
    } finally { setBusy(false); }
  };

  const handleRemove = async (memberId: string) => {
    setBusy(true);
    try { await api.delete(`/wba/projects/${project.id}/members/${memberId}`); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Assign team</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>{project.projectName}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {project.members.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {project.members.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{m.employee.name}</div>
                    {m.employeeDeadline && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>Deadline: {formatDate(m.employeeDeadline)}</div>}
                  </div>
                  <button onClick={() => handleRemove(m.id)} disabled={busy} title="Remove"
                    style={{ background: "none", border: "none", color: "#f87171", cursor: busy ? "default" : "pointer", padding: 4 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Field label="Add employee">
            <div style={{ display: "flex", gap: 8 }}>
              <select value={pickEmployeeId} onChange={e => setPickEmployeeId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                <option value="">Select employee...</option>
                {available.map(e => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` · ${e.designation}` : ""}</option>)}
              </select>
            </div>
          </Field>
          {pickEmployeeId && (
            <Field label="Their deadline">
              <input type="date" value={pickDeadline} onChange={e => setPickDeadline(e.target.value)} style={inputStyle} />
            </Field>
          )}
          <button onClick={handleAdd} disabled={!pickEmployeeId || busy}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 16px", borderRadius: 8, border: "none", background: "#2FB8A6", color: "#06231f", fontWeight: 700, cursor: (!pickEmployeeId || busy) ? "default" : "pointer", fontSize: 13.5, opacity: (!pickEmployeeId || busy) ? 0.6 : 1 }}>
            <UserPlus size={15} /> Add to project
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project card ─────────────────────────────────────────────────
function ProjectCard({ project, level, myEmployeeId, onChanged }: { project: WBAProject; level: WBALevel; myEmployeeId: string | null; onChanged: () => void }) {
  const [showAssign, setShowAssign] = useState(false);
  const catLabel = WBA_CATEGORIES[project.category] || project.category;
  const myDeadline = project.members.find(m => m.employee.id === myEmployeeId)?.employeeDeadline;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#2FB8A6", background: "rgba(47,184,166,0.1)", padding: "2px 7px", borderRadius: 5 }}>{catLabel}</span>
          </div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{project.projectName}</h4>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-ghost)", display: "flex", alignItems: "center", gap: 5 }}>
            <Building2 size={12} /> {project.clientName}
          </p>
        </div>
        <StatusSelect project={project} onChanged={onChanged} editable={CAN_WRITE.includes(level)} />
      </div>

      {project.description && <p style={{ fontSize: 13, color: "var(--text-sec)", margin: "10px 0" }}>{project.description}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12, fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-ghost)" }}>
          <Calendar size={13} />
          Client deadline: <b style={{ color: "var(--text-sec)" }}>{project.clientDeadline ? formatDate(project.clientDeadline) : "—"}</b>
        </div>
        {myEmployeeId && myDeadline && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#fbbf24" }}>
            <Calendar size={13} />
            Your deadline: <b>{formatDate(myDeadline)}</b>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        <Users size={13} color="var(--text-ghost)" />
        {project.members.map(m => (
          <span key={m.id} title={m.employeeDeadline ? `Deadline: ${formatDate(m.employeeDeadline)}` : undefined}
            style={{ fontSize: 11.5, color: "var(--text-sec)", background: "var(--bg-hover)", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--border)" }}>
            {m.employee.name}
          </span>
        ))}
        {project.members.length === 0 && <span style={{ fontSize: 11.5, color: "var(--text-ghost)" }}>Unstaffed</span>}
        {level === "OWNER" && (
          <button onClick={() => setShowAssign(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#2FB8A6", background: "none", border: "1px dashed rgba(47,184,166,0.4)", borderRadius: 99, padding: "2px 9px", cursor: "pointer" }}>
            <UserPlus size={12} /> Assign team
          </button>
        )}
      </div>

      {showAssign && <AssignTeamModal project={project} onClose={() => setShowAssign(false)} onChanged={onChanged} />}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        border: active ? "1px solid #2FB8A6" : "1px solid var(--border)",
        background: active ? "rgba(47,184,166,0.12)" : "var(--bg-card)",
        color: active ? "#2FB8A6" : "var(--text-sec)",
      }}>
      {label}
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function WBAPage() {
  const { user } = useAuthStore();
  const [level, setLevel] = useState<WBALevel | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<WBAProject[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get("quickAdd") === "project");
  const [convertTarget, setConvertTarget] = useState<Opportunity | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => { api.get("/wba/me").then(r => setLevel(r.data.data.level)).catch(() => setLevel("STAFF")); }, []);

  const seesAll = level !== null && CAN_SEE_ALL.includes(level);
  const isOwner = level === "OWNER";

  const load = useCallback(async () => {
    if (level === null) return;
    setLoading(true);
    try {
      const [projRes, oppRes] = await Promise.allSettled([
        api.get("/wba/projects", { params: statusFilter !== "ALL" ? { status: statusFilter } : {} }),
        seesAll ? api.get("/wba/opportunities") : Promise.resolve(null),
      ]);
      if (projRes.status === "fulfilled") {
        const data: WBAProject[] = projRes.value.data.data || [];
        setProjects(data);
        const mine = data.find(p => p.members.some(m => m.employee.userId === user?.id));
        setMyEmployeeId(mine?.members.find(m => m.employee.userId === user?.id)?.employee.id || null);
      }
      if (oppRes.status === "fulfilled") {
        const oppValue = oppRes.value;
        if (oppValue) setOpportunities(oppValue.data.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, seesAll, level, user?.id]);

  useEffect(() => { load(); }, [load]);

  if (level === null) {
    return <div style={{ padding: 24, color: "var(--text-ghost)", fontSize: 13 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={22} color="#2FB8A6" /> Service Delivery
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-ghost)" }}>
            VAPT · GRC · SOC · Digital Forensics · Awareness Training · Coaching — from accepted quotation to sign-off.
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 9, border: "none", background: "#2FB8A6", color: "#06231f", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {seesAll && opportunities.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sec)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Sparkles size={14} color="#fbbf24" /> Ready to Start ({opportunities.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {opportunities.map(o => (
              <div key={o.id} onClick={() => CAN_WRITE.includes(level) && setConvertTarget(o)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 10, padding: "12px 16px", cursor: CAN_WRITE.includes(level) ? "pointer" : "default" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{o.subject || o.quotationNumber}</div>
                  <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>{o.party?.name} · Quotation {o.quotationNumber} accepted</div>
                </div>
                {CAN_WRITE.includes(level) && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#fbbf24", fontWeight: 700 }}>
                    Create project <ArrowRight size={13} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <FilterChip label="All" active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} />
        {Object.entries(WBA_STATUSES).map(([k, v]) => (
          <FilterChip key={k} label={v.label} active={statusFilter === k} onClick={() => setStatusFilter(k)} />
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-ghost)", fontSize: 13 }}>Loading...</p>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-ghost)" }}>
          <ShieldCheck size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ fontSize: 14, margin: 0 }}>No projects yet.</p>
          <p style={{ fontSize: 12.5, margin: "4px 0 0" }}>
            {seesAll ? "Add one, or wait for an accepted quotation to land in the Ready to Start queue." : "You'll see projects here once you're assigned to one."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} level={level} myEmployeeId={myEmployeeId} onChanged={load} />
          ))}
        </div>
      )}

      {showForm && <WBAProjectFormModal isOwner={isOwner} onClose={() => { setShowForm(false); if (searchParams.get("quickAdd")) { searchParams.delete("quickAdd"); setSearchParams(searchParams, { replace: true }); } }} onSaved={load} />}
      {convertTarget && <WBAProjectFormModal opportunity={convertTarget} isOwner={isOwner} onClose={() => setConvertTarget(null)} onSaved={load} />}
    </div>
  );
}
