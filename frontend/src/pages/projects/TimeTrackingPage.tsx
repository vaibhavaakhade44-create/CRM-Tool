import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Timer, Plus, X, Clock, TrendingUp, DollarSign, Users } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  tabs: { display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 } as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" as const } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 480, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  fltSelect: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const },
};

interface TimeEntry { id: string; projectId: string; userId: string; description?: string; hours: number; date: string; billable: boolean; approved: boolean; project?: { name: string } | null; }
interface Project { id: string; name: string; }
interface Summary { totalHours: number; billableHours: number; byProject: Record<string, number>; byUser: Record<string, number>; }

const EMPTY_ENTRY = { projectId: "", taskId: "", userId: "", description: "", hours: "", date: new Date().toISOString().split("T")[0], billable: true };

export default function TimeTrackingPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"entries" | "summary" | "sla" | "allocation">("entries");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [projectFilter, setProjectFilter] = useState("");

  // SLA state
  const [slaPolicies, setSLAPolicies] = useState<any[]>([]);
  const [showSLAModal, setShowSLAModal] = useState(false);
  const [slaForm, setSLAForm] = useState({ name: "", firstResponseHours: "4", resolutionHours: "24", appliesTo: "SUPPORT" });

  // Resource allocation state
  const [allocations, setAllocations] = useState<any[]>([]);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [allocForm, setAllocForm] = useState({ projectId: "", userId: "", role: "", allocationPct: "100" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectFilter) params.set("projectId", projectFilter);

      const [eRes, pRes, sRes, slaRes, aRes] = await Promise.all([
        api.get(`/time-tracking/entries?${params}`),
        api.get("/it-projects?limit=100"),
        api.get(`/time-tracking/entries/summary?${params}`),
        api.get("/time-tracking/sla"),
        api.get("/time-tracking/allocations"),
      ]);
      setEntries(eRes.data.data?.entries || []);
      setProjects(pRes.data.data || []);
      setSummary(sRes.data.data);
      setSLAPolicies(slaRes.data.data || []);
      setAllocations(aRes.data.data || []);
    } catch {}
    setLoading(false);
  }, [projectFilter]);

  useEffect(() => { load(); }, [load]);

  const saveEntry = async () => {
    if (!form.projectId || !form.hours) return;
    setSaving(true);
    try {
      await api.post("/time-tracking/entries", { ...form, hours: Number(form.hours) });
      setShowModal(false);
      setForm(EMPTY_ENTRY);
      load();
    } catch {}
    setSaving(false);
  };

  const saveSLA = async () => {
    if (!slaForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/time-tracking/sla", { ...slaForm, firstResponseHours: Number(slaForm.firstResponseHours), resolutionHours: Number(slaForm.resolutionHours) });
      setShowSLAModal(false);
      setSLAForm({ name: "", firstResponseHours: "4", resolutionHours: "24", appliesTo: "SUPPORT" });
      load();
    } catch {}
    setSaving(false);
  };

  const saveAlloc = async () => {
    if (!allocForm.projectId || !allocForm.userId) return;
    setSaving(true);
    try {
      await api.post("/time-tracking/allocations", { ...allocForm, allocationPct: Number(allocForm.allocationPct) });
      setShowAllocModal(false);
      setAllocForm({ projectId: "", userId: "", role: "", allocationPct: "100" });
      load();
    } catch {}
    setSaving(false);
  };

  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      style={{ padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400,
               color: tab === id ? "var(--text-primary)" : "var(--text-ghost)", borderBottom: tab === id ? "2px solid #818cf8" : "2px solid transparent", marginBottom: -1 }}
    >
      {label}
    </button>
  );

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}><Timer size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />{ t('page_time_tracking') }</h1>
          <p style={S.subtitle}>Track billable hours, manage SLA policies, and allocate team resources</p>
        </div>
        {tab === "entries" && <button style={S.btn} onClick={() => setShowModal(true)}><Plus size={15} /> Log Time</button>}
        {tab === "sla" && <button style={S.btn} onClick={() => setShowSLAModal(true)}><Plus size={15} /> Add Policy</button>}
        {tab === "allocation" && <button style={S.btn} onClick={() => setShowAllocModal(true)}><Plus size={15} /> Allocate</button>}
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Hours", value: summary.totalHours.toFixed(1), color: "#818cf8", icon: Clock },
            { label: "Billable Hours", value: summary.billableHours.toFixed(1), color: "#10b981", icon: DollarSign },
            { label: "Non-Billable", value: (summary.totalHours - summary.billableHours).toFixed(1), color: "#f59e0b", icon: TrendingUp },
            { label: "Utilization", value: summary.totalHours > 0 ? `${Math.round((summary.billableHours / summary.totalHours) * 100)}%` : "0%", color: "#6366f1", icon: Users },
          ].map(k => (
            <div key={k.label} style={S.kpi}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>{k.label}</span>
                <k.icon size={15} color={k.color} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={S.tabs}>
        <TabBtn id="entries" label="Time Entries" />
        <TabBtn id="summary" label="Summary" />
        <TabBtn id="sla" label="SLA Policies" />
        <TabBtn id="allocation" label="Resource Allocation" />
      </div>

      {tab === "entries" && (
        <div style={S.card}>
          <div style={S.toolbar}>
            <select style={S.fltSelect} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead>
              <tr>{["Date", "Project", "Description", "Hours", "Billable", "Approved"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>No time entries yet</td></tr>
              ) : entries.map(e => (
                <tr key={e.id}>
                  <td style={S.td}>{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td style={S.td}>{e.project?.name ?? "—"}</td>
                  <td style={S.td}>{e.description ?? "—"}</td>
                  <td style={S.td}><span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{e.hours}h</span></td>
                  <td style={S.td}><span style={{ color: e.billable ? "#10b981" : "#6b7280", fontWeight: 600 }}>{e.billable ? "Yes" : "No"}</span></td>
                  <td style={S.td}><span style={{ color: e.approved ? "#10b981" : "#f59e0b", fontWeight: 600 }}>{e.approved ? "Approved" : "Pending"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "summary" && summary && (
        <div className="grid-r2" style={{ gap: 20 }}>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Hours by Project</div>
            {Object.entries(summary.byProject).map(([pid, hrs]) => {
              const proj = projects.find(p => p.id === pid);
              const pct = summary.totalHours > 0 ? (hrs / summary.totalHours) * 100 : 0;
              return (
                <div key={pid} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{proj?.name ?? pid.slice(0, 8)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{(hrs as number).toFixed(1)}h</span>
                  </div>
                  <div style={{ background: "var(--bg-hover)", borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${pct}%`, background: "#818cf8", borderRadius: 4, height: 6 }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(summary.byProject).length === 0 && <div style={{ color: "var(--text-ghost)", textAlign: "center", padding: 20 }}>No data</div>}
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Hours by Team Member</div>
            {Object.entries(summary.byUser).map(([uid, hrs]) => (
              <div key={uid} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bg-hover)" }}>
                <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{uid.slice(0, 12)}...</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>{(hrs as number).toFixed(1)}h</span>
              </div>
            ))}
            {Object.keys(summary.byUser).length === 0 && <div style={{ color: "var(--text-ghost)", textAlign: "center", padding: 20 }}>No data</div>}
          </div>
        </div>
      )}

      {tab === "sla" && (
        <div style={S.card}>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead>
              <tr>{["Policy Name", "First Response", "Resolution", "Applies To", "Tickets"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {slaPolicies.length === 0 ? (
                <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", padding: 32 }}>No SLA policies defined</td></tr>
              ) : slaPolicies.map((p: any) => (
                <tr key={p.id}>
                  <td style={S.td}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span></td>
                  <td style={S.td}>{p.firstResponseHours}h</td>
                  <td style={S.td}>{p.resolutionHours}h</td>
                  <td style={S.td}>{p.appliesTo}</td>
                  <td style={S.td}>{p._count?.tickets ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "allocation" && (
        <div style={S.card}>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead>
              <tr>{["Project", "User ID", "Role", "Allocation %", "Start Date", "End Date"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>No allocations defined</td></tr>
              ) : allocations.map((a: any) => (
                <tr key={a.id}>
                  <td style={S.td}>{a.project?.name ?? "—"}</td>
                  <td style={S.td}>{a.userId.slice(0, 12)}...</td>
                  <td style={S.td}>{a.role ?? "—"}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, background: "var(--bg-hover)", borderRadius: 4, height: 6, maxWidth: 80 }}>
                        <div style={{ width: `${a.allocationPct}%`, background: "#818cf8", borderRadius: 4, height: 6 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{a.allocationPct}%</span>
                    </div>
                  </td>
                  <td style={S.td}>{a.startDate ? new Date(a.startDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td style={S.td}>{a.endDate ? new Date(a.endDate).toLocaleDateString("en-IN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Log Time Modal */}
      {showModal && (
        <div style={S.modal} onClick={() => setShowModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Log Time</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={S.label}>Project *</label>
                <select style={S.select} value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))}>
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Hours *</label>
                  <input type="number" min="0.25" step="0.25" style={S.input} placeholder="1.5" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Date</label>
                  <input type="date" style={S.input} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={S.label}>Description</label>
                <input style={S.input} placeholder="What did you work on?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="billable" checked={form.billable} onChange={e => setForm(p => ({ ...p, billable: e.target.checked }))} />
                <label htmlFor="billable" style={{ fontSize: 13, color: "var(--text-sec)", cursor: "pointer" }}>Billable</label>
              </div>
              <button onClick={saveEntry} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>
                {saving ? "Saving..." : "Log Time"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLA Modal */}
      {showSLAModal && (
        <div style={S.modal} onClick={() => setShowSLAModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>New SLA Policy</h2>
              <button onClick={() => setShowSLAModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Policy Name</label><input style={S.input} value={slaForm.name} onChange={e => setSLAForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid-r2">
                <div><label style={S.label}>First Response (hours)</label><input type="number" style={S.input} value={slaForm.firstResponseHours} onChange={e => setSLAForm(p => ({ ...p, firstResponseHours: e.target.value }))} /></div>
                <div><label style={S.label}>Resolution (hours)</label><input type="number" style={S.input} value={slaForm.resolutionHours} onChange={e => setSLAForm(p => ({ ...p, resolutionHours: e.target.value }))} /></div>
              </div>
              <div><label style={S.label}>Applies To</label>
                <select style={S.select} value={slaForm.appliesTo} onChange={e => setSLAForm(p => ({ ...p, appliesTo: e.target.value }))}>
                  {["SUPPORT","PROJECT","CONTRACT"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={saveSLA} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Create Policy"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Modal */}
      {showAllocModal && (
        <div style={S.modal} onClick={() => setShowAllocModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Allocate Resource</h2>
              <button onClick={() => setShowAllocModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Project *</label>
                <select style={S.select} value={allocForm.projectId} onChange={e => setAllocForm(p => ({ ...p, projectId: e.target.value }))}>
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={S.label}>User ID *</label><input style={S.input} placeholder="User ID" value={allocForm.userId} onChange={e => setAllocForm(p => ({ ...p, userId: e.target.value }))} /></div>
              <div className="grid-r2">
                <div><label style={S.label}>Role</label><input style={S.input} placeholder="e.g. Developer" value={allocForm.role} onChange={e => setAllocForm(p => ({ ...p, role: e.target.value }))} /></div>
                <div><label style={S.label}>Allocation %</label><input type="number" min="0" max="100" style={S.input} value={allocForm.allocationPct} onChange={e => setAllocForm(p => ({ ...p, allocationPct: e.target.value }))} /></div>
              </div>
              <button onClick={saveAlloc} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Allocate"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
