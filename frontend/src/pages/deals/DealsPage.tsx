import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Briefcase, Plus, Search, X, TrendingUp, LayoutList, Kanban, Target, DollarSign } from "lucide-react";
import DocumentsPanel from "@/components/DocumentsPanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useTranslation } from 'react-i18next';

const S = {
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  kpiValue: { fontSize: 26, fontWeight: 700, margin: "4px 0 0" } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const },
  td: { padding: "12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
};

const STAGES = [
  { key: "PROSPECTING",    label: "Prospecting",    color: "#818cf8", prob: 10 },
  { key: "QUALIFICATION",  label: "Qualification",  color: "#60a5fa", prob: 20 },
  { key: "NEEDS_ANALYSIS", label: "Needs Analysis", color: "#a78bfa", prob: 40 },
  { key: "PROPOSAL",       label: "Proposal",       color: "#f59e0b", prob: 60 },
  { key: "NEGOTIATION",    label: "Negotiation",    color: "#fb923c", prob: 80 },
  { key: "CLOSED_WON",     label: "Closed Won",     color: "#10b981", prob: 100 },
  { key: "CLOSED_LOST",    label: "Closed Lost",    color: "#ef4444", prob: 0 },
];
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));

interface Deal { id: string; title: string; stage: string; value?: number; probability: number; expectedCloseDate?: string; party?: { id: string; name: string } | null; description?: string; createdAt: string; }
interface Stats { total: number; won: number; lost: number; openDeals: number; pipeline: number; wonValue: number; forecastValue: number; byStage: Array<{ stage: string; count: number; value: number }>; }
interface Party { id: string; name: string; }

const emptyForm = { title: "", stage: "PROSPECTING", value: "", probability: "20", partyId: "", expectedCloseDate: "", description: "", notes: "" };

export default function DealsPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes, pRes] = await Promise.all([
        api.get("/deals/stats"),
        api.get(`/deals?limit=300&search=${search}&stage=${stageFilter}`),
        api.get("/parties?limit=300"),
      ]);
      setStats(sRes.data.data);
      setDeals(dRes.data.data.deals || []);
      setParties(pRes.data.data?.parties || pRes.data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, stageFilter]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (d: Deal) => {
    setEditId(d.id);
    setForm({ title: d.title, stage: d.stage, value: d.value ? String(d.value) : "", probability: String(d.probability), partyId: d.party?.id || "", expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.slice(0, 10) : "", description: d.description || "", notes: "" });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, value: form.value ? parseFloat(form.value) : undefined, probability: parseInt(form.probability) || 20, partyId: form.partyId || undefined, expectedCloseDate: form.expectedCloseDate || undefined, description: form.description || undefined };
      if (editId) await api.patch(`/deals/${editId}`, payload);
      else await api.post("/deals", payload);
      setShowModal(false); load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const deleteDeal = async (id: string) => {
    try { await api.delete(`/deals/${id}`); load(); } catch { /* ignore */ }
  };

  const fmtVal = (v?: number) => v ? `₹${v.toLocaleString("en-IN")}` : "—";
  const fmtL = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString("en-IN")}`;

  const filtered = deals.filter(d =>
    (!stageFilter || d.stage === stageFilter) &&
    (!search || d.title.toLowerCase().includes(search.toLowerCase()) || (d.party?.name || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>{ t('page_deals') }</h1>
          <p style={S.subtitle}>Track your sales pipeline from prospect to close — Salesforce / HubSpot style</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setViewMode("kanban")} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${viewMode === "kanban" ? "#6366f1" : "var(--border)"}`, background: viewMode === "kanban" ? "#6366f120" : "transparent", color: viewMode === "kanban" ? "#818CF8" : "var(--text-ghost)", cursor: "pointer" }}><Kanban size={16} /></button>
          <button onClick={() => setViewMode("table")} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${viewMode === "table" ? "#6366f1" : "var(--border)"}`, background: viewMode === "table" ? "#6366f120" : "transparent", color: viewMode === "table" ? "#818CF8" : "var(--text-ghost)", cursor: "pointer" }}><LayoutList size={16} /></button>
          <button style={S.btn} onClick={() => { setEditId(null); setForm({ ...emptyForm }); setError(""); setShowModal(true); }}><Plus size={15} /> New Deal</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label: "Total Deals", value: stats?.total ?? "—", color: "#6366f1" },
          { label: "Pipeline Value", value: stats ? fmtL(stats.pipeline) : "—", color: "#f59e0b" },
          { label: "Won Value", value: stats ? fmtL(stats.wonValue) : "—", color: "#10b981" },
          { label: "Forecast", value: stats ? fmtL(stats.forecastValue) : "—", color: "#818cf8" },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <span style={S.kpiLabel}>{k.label}</span>
            <div style={{ ...S.kpiValue, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Stage filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        <button onClick={() => setStageFilter("")} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${!stageFilter ? "#6366f1" : "var(--border)"}`, background: !stageFilter ? "#6366f120" : "transparent", color: !stageFilter ? "#818CF8" : "var(--text-ghost)", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>All ({deals.length})</button>
        {STAGES.map(s => {
          const count = deals.filter(d => d.stage === s.key).length;
          return (
            <button key={s.key} onClick={() => setStageFilter(stageFilter === s.key ? "" : s.key)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${stageFilter === s.key ? s.color : s.color + "40"}`, background: stageFilter === s.key ? s.color + "25" : "transparent", color: s.color, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 340, marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
        <input style={{ ...S.input, paddingLeft: 34 }} placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Kanban View */}
      {viewMode === "kanban" && !loading && (
        <div style={{ overflowX: "auto", paddingBottom: 16 }}>
          <div style={{ display: "flex", gap: 14, minWidth: "max-content" }}>
            {STAGES.map(stage => {
              const stageDeals = filtered.filter(d => d.stage === stage.key);
              const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
              return (
                <div key={stage.key} style={{ width: 240, flexShrink: 0 }}>
                  <div style={{ background: "var(--bg-card)", border: `1px solid ${stage.color}30`, borderRadius: "10px 10px 0 0", padding: "10px 14px", borderBottom: `2px solid ${stage.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, textTransform: "uppercase" }}>{stage.label}</span>
                      <span style={{ background: stage.color + "25", color: stage.color, borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "1px 8px" }}>{stageDeals.length}</span>
                    </div>
                    {stageValue > 0 && <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>{fmtL(stageValue)}</div>}
                    <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 2 }}>{stage.prob}% probability</div>
                  </div>
                  <div style={{ background: "var(--bg-hover)", border: `1px solid ${stage.color}20`, borderTop: "none", borderRadius: "0 0 10px 10px", minHeight: 160, padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    {stageDeals.length === 0 && <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-ghost)", fontSize: 12 }}>No deals</div>}
                    {stageDeals.map(d => (
                      <div key={d.id} onClick={() => openEdit(d)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = stage.color + "60")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                        {d.party && <div style={{ fontSize: 11, color: "#818CF8", marginBottom: 4 }}>{d.party.name}</div>}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {d.value ? <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>{fmtVal(d.value)}</span> : <span />}
                          {d.expectedCloseDate && <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>{new Date(d.expectedCloseDate).toLocaleDateString("en-IN")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div style={S.card}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Deal Title", "Party", "Stage", "Value", "Probability", "Close Date", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No deals yet. Create your first deal!</td></tr>
                    : filtered.map(d => {
                      const stage = STAGE_MAP[d.stage];
                      return (
                        <tr key={d.id} onClick={() => openEdit(d)} style={{ cursor: "pointer" }}>
                          <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 600 }}>{d.title}</td>
                          <td style={S.td}>{d.party?.name || "—"}</td>
                          <td style={S.td}><span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (stage?.color || "#818cf8") + "20", color: stage?.color || "#818cf8" }}>{stage?.label || d.stage}</span></td>
                          <td style={{ ...S.td, color: "#10b981", fontWeight: 600 }}>{fmtVal(d.value)}</td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ height: 4, width: 60, background: "var(--bg-hover)", borderRadius: 2 }}>
                                <div style={{ height: "100%", width: `${d.probability}%`, background: stage?.color || "#818cf8", borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 11, color: stage?.color || "#818cf8" }}>{d.probability}%</span>
                            </div>
                          </td>
                          <td style={S.td}>{d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString("en-IN") : "—"}</td>
                          <td style={S.td}><button onClick={e => { e.stopPropagation(); setDeleteId(d.id); }} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>✕</button></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>{editId ? "Edit Deal" : "New Deal"}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={S.label}>Deal Title *</label>
                <input style={S.input} placeholder="e.g. Website Redesign for ABC Corp" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Stage</label>
                  <select style={S.select} value={form.stage} onChange={e => { const s = STAGES.find(x => x.key === e.target.value); setForm(p => ({ ...p, stage: e.target.value, probability: String(s?.prob ?? 20) })); }}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Party / Customer</label>
                  <select style={S.select} value={form.partyId} onChange={e => setForm(p => ({ ...p, partyId: e.target.value }))}>
                    <option value="">— None —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Deal Value ₹</label>
                  <input type="number" style={S.input} placeholder="0" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Probability %</label>
                  <input type="number" min={0} max={100} style={S.input} value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))} />
                </div>
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Expected Close Date</label>
                  <input type="date" style={S.input} value={form.expectedCloseDate} onChange={e => setForm(p => ({ ...p, expectedCloseDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={S.label}>Description</label>
                <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} placeholder="What's this deal about?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            {editId && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <DocumentsPanel entityType="DEAL" entityId={editId} compact />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={save} style={S.btn} disabled={saving}>{saving ? "Saving..." : editId ? "Update Deal" : "Create Deal"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <ConfirmDialog
          title="Delete Deal"
          message="This deal and all its data will be permanently deleted. This cannot be undone."
          confirmLabel="Delete Deal"
          onConfirm={() => { deleteDeal(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
