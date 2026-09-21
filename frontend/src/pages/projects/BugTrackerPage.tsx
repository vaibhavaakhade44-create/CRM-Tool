import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Bug, Plus, Search, X, MessageSquare, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" as const } as React.CSSProperties,
  searchWrap: { position: "relative" as const, flex: 1, maxWidth: 300 },
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  searchIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 560, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, minHeight: 80 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  fltSelect: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const },
};

const SEVERITY_COLORS: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#6b7280" };
const STATUS_COLORS: Record<string, string> = { OPEN: "#818cf8", IN_PROGRESS: "#f59e0b", RESOLVED: "#10b981", CLOSED: "#6b7280", WONT_FIX: "#6b7280", DUPLICATE: "#9ca3af" };

interface BugItem { id: string; title: string; severity: string; status: string; priority: string; assignedToId?: string; project?: { name: string } | null; createdAt: string; _count: { comments: number }; }
interface Project { id: string; name: string; }

const EMPTY = { title: "", description: "", projectId: "", severity: "MEDIUM", priority: "MEDIUM", stepsToRepro: "", expectedResult: "", actualResult: "", environment: "", assignedToId: "" };

export default function BugTrackerPage() {
  const { t } = useTranslation();
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [selected, setSelected] = useState<BugItem | null>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);

      const [bRes, pRes, sRes] = await Promise.all([
        api.get(`/bugs?${params}`),
        api.get("/it-projects?limit=100"),
        api.get("/bugs/stats"),
      ]);
      setBugs(bRes.data.data);
      setProjects(pRes.data.data || []);
      setStats(sRes.data.data);
    } catch {}
    setLoading(false);
  }, [search, statusFilter, severityFilter]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.post("/bugs", form);
      setShowModal(false);
      setForm(EMPTY);
      load();
    } catch {}
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try { await api.patch(`/bugs/${id}`, { status }); load(); } catch {}
  };

  const addComment = async (bugId: string) => {
    if (!comment.trim()) return;
    try { await api.post(`/bugs/${bugId}/comments`, { comment }); setComment(""); load(); } catch {}
  };

  const totalBySeverity = (sev: string) => stats?.bySeverity?.find((s: any) => s.severity === sev)?._count?.id ?? 0;
  const totalByStatus = (st: string) => stats?.byStatus?.find((s: any) => s.status === st)?._count?.id ?? 0;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}><Bug size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />{ t('page_bug_tracker') }</h1>
          <p style={S.subtitle}>Track issues, bugs, and defects across all projects</p>
        </div>
        <button style={S.btn} onClick={() => { setShowModal(true); setForm(EMPTY); }}>
          <Plus size={15} /> Report Bug
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Critical", value: totalBySeverity("CRITICAL"), color: "#ef4444", icon: AlertTriangle },
          { label: "Open", value: totalByStatus("OPEN"), color: "#818cf8", icon: Bug },
          { label: "In Progress", value: totalByStatus("IN_PROGRESS"), color: "#f59e0b", icon: Clock },
          { label: "Resolved", value: totalByStatus("RESOLVED"), color: "#10b981", icon: CheckCircle },
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

      <div style={S.card}>
        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <Search size={14} style={S.searchIcon} />
            <input style={S.searchInput} placeholder="Search bugs..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select style={S.fltSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {["OPEN","IN_PROGRESS","RESOLVED","CLOSED","WONT_FIX","DUPLICATE"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={S.fltSelect} value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
            <option value="">All Severity</option>
            {["CRITICAL","HIGH","MEDIUM","LOW"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>Loading bugs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead>
              <tr>
                {["Bug", "Severity", "Status", "Project", "Comments", "Actions"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bugs.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>No bugs found</td></tr>
              ) : bugs.map(bug => (
                <tr key={bug.id} style={{ cursor: "pointer" }} onClick={() => setSelected(bug)}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{bug.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{new Date(bug.createdAt).toLocaleDateString("en-IN")}</div>
                  </td>
                  <td style={S.td}>
                    <span style={{ background: (SEVERITY_COLORS[bug.severity] ?? "#6b7280") + "22", color: SEVERITY_COLORS[bug.severity] ?? "#6b7280", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>
                      {bug.severity}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={{ background: (STATUS_COLORS[bug.status] ?? "#6b7280") + "22", color: STATUS_COLORS[bug.status] ?? "#6b7280", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>
                      {bug.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={S.td}>{bug.project?.name ?? "—"}</td>
                  <td style={S.td}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <MessageSquare size={12} /> {bug._count.comments}
                    </span>
                  </td>
                  <td style={S.td} onClick={e => e.stopPropagation()}>
                    <select value={bug.status} onChange={e => updateStatus(bug.id, e.target.value)}
                      style={{ ...S.fltSelect, fontSize: 11, padding: "4px 8px" }}>
                      {["OPEN","IN_PROGRESS","RESOLVED","CLOSED","WONT_FIX","DUPLICATE"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Create Bug Modal */}
      {showModal && (
        <div style={S.modal} onClick={() => setShowModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Report Bug</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={S.label}>Bug Title *</label>
                <input style={S.input} placeholder="Brief description of the bug" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Project</label>
                  <select style={S.select} value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))}>
                    <option value="">None</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Severity</label>
                  <select style={S.select} value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                    {["LOW","MEDIUM","HIGH","CRITICAL"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={S.label}>Description</label>
                <textarea style={S.textarea} placeholder="What happened?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Steps to Reproduce</label>
                <textarea style={{ ...S.textarea, minHeight: 60 }} placeholder="1. Go to...\n2. Click on...\n3. See error" value={form.stepsToRepro} onChange={e => setForm(p => ({ ...p, stepsToRepro: e.target.value }))} />
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Expected Result</label>
                  <input style={S.input} placeholder="What should happen?" value={form.expectedResult} onChange={e => setForm(p => ({ ...p, expectedResult: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Actual Result</label>
                  <input style={S.input} placeholder="What actually happened?" value={form.actualResult} onChange={e => setForm(p => ({ ...p, actualResult: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={S.label}>Environment</label>
                <input style={S.input} placeholder="e.g. Chrome 120, Windows 11, Prod" value={form.environment} onChange={e => setForm(p => ({ ...p, environment: e.target.value }))} />
              </div>
              <button onClick={save} disabled={saving} style={{ ...S.btn, justifyContent: "center", marginTop: 4 }}>
                {saving ? "Saving..." : "Report Bug"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bug Detail Modal */}
      {selected && (
        <div style={S.modal} onClick={() => setSelected(null)}>
          <div style={{ ...S.modalBox, width: 620 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{selected.title}</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ background: (SEVERITY_COLORS[selected.severity] ?? "#6b7280") + "22", color: SEVERITY_COLORS[selected.severity] ?? "#6b7280", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{selected.severity}</span>
                  <span style={{ background: (STATUS_COLORS[selected.status] ?? "#6b7280") + "22", color: STATUS_COLORS[selected.status] ?? "#6b7280", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{selected.status.replace("_", " ")}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...S.fltSelect, cursor: "pointer", fontSize: 12 }}
                  onClick={async () => { const newStatus = selected.status === "OPEN" ? "IN_PROGRESS" : selected.status === "IN_PROGRESS" ? "RESOLVED" : "OPEN"; await updateStatus(selected.id, newStatus); setSelected({ ...selected, status: newStatus }); }}
                >
                  Change Status
                </button>
              </div>

              <div style={{ background: "var(--bg-hover)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Add Comment</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...S.input, flex: 1 }} placeholder="Write a comment..." value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment(selected.id)} />
                  <button onClick={() => addComment(selected.id)} style={{ ...S.btn, padding: "9px 14px" }}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
