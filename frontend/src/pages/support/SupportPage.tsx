import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Headphones, Plus, Search, X, MessageSquare } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  kpiValue: { fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16 } as React.CSSProperties,
  searchWrap: { position: "relative" as const, flex: 1, maxWidth: 300 },
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  searchIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 500, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
};

const STATUS_COLORS: Record<string, string> = { OPEN: "#818cf8", IN_PROGRESS: "#f59e0b", WAITING: "#60a5fa", RESOLVED: "#10b981", CLOSED: "#6b7280" };
const PRIORITY_COLORS: Record<string, string> = { LOW: "#6b7280", MEDIUM: "#818cf8", HIGH: "#f59e0b", URGENT: "#ef4444" };

interface Stats { open: number; inProgress: number; resolved: number; urgent: number; }
interface Ticket { id: string; ticketNumber: string; subject: string; status: string; priority: string; createdAt: string; party?: { name: string } | null; _count?: { replies: number }; }
interface Party { id: string; name: string; }

export default function SupportPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ subject: "", description: "", priority: "MEDIUM", partyId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, tRes, pRes] = await Promise.all([
        api.get("/support/stats"),
        api.get(`/support?search=${search}&status=${statusFilter}&limit=100`),
        api.get("/parties?limit=200"),
      ]);
      setStats(sRes.data.data);
      setTickets(tRes.data.data.tickets);
      setParties(pRes.data.data.parties);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/support", { ...form, partyId: form.partyId || undefined });
      setShowModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try { await api.patch(`/support/${id}/status`, { status }); load(); } catch { /* ignore */ }
  };

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>{ t('page_support') }</h1>
          <p style={S.subtitle}>Helpdesk tickets, SLA tracking, and issue resolution</p>
        </div>
        <button style={S.btn} onClick={() => { setForm({ subject: "", description: "", priority: "MEDIUM", partyId: "" }); setError(""); setShowModal(true); }}>
          <Plus size={15} /> New Ticket
        </button>
      </div>

      <div className="kpi-grid">
        {[
          { label: "Open Tickets", value: stats?.open ?? "—", color: "#818cf8" },
          { label: "In Progress", value: stats?.inProgress ?? "—", color: "#f59e0b" },
          { label: "Resolved", value: stats?.resolved ?? "—", color: "#10b981" },
          { label: "Urgent", value: stats?.urgent ?? "—", color: "#ef4444" },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <span style={S.kpiLabel}>{k.label}</span>
            <div style={{ ...S.kpiValue as object, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const }}>
        {["", ...Object.keys(STATUS_COLORS)].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${s && STATUS_COLORS[s] ? STATUS_COLORS[s] + (statusFilter === s ? "" : "40") : "var(--border)"}`, background: statusFilter === s ? (s ? STATUS_COLORS[s] + "25" : "var(--border)") : "transparent", color: s && STATUS_COLORS[s] ? STATUS_COLORS[s] : "var(--text-ghost)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <Search size={14} style={S.searchIcon} />
            <input style={S.searchInput} placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
          <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Ticket#", "Subject", "Customer", "Priority", "Replies", "Status", "Created", "Action"].map(h => <th key={h} style={{ ...S.th, whiteSpace: "nowrap" as const }}>{h}</th>)}</tr></thead>
            <tbody>
              {tickets.length === 0 ? <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No tickets yet.</td></tr> : tickets.map(t => (
                <tr key={t.id}>
                  <td style={{ ...S.td, color: "#818CF8", fontWeight: 600 }}>{t.ticketNumber}</td>
                  <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 500, maxWidth: 200 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span></td>
                  <td style={S.td}>{t.party?.name || "—"}</td>
                  <td style={S.td}><span style={{ padding: "2px 6px", borderRadius: 5, fontSize: 10, background: (PRIORITY_COLORS[t.priority] || "#818cf8") + "25", color: PRIORITY_COLORS[t.priority] || "#818cf8", fontWeight: 600 }}>{t.priority}</span></td>
                  <td style={S.td}><MessageSquare size={12} style={{ display: "inline", marginRight: 4, color: "var(--text-ghost)" }} />{t._count?.replies || 0}</td>
                  <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (STATUS_COLORS[t.status] || "#818cf8") + "20", color: STATUS_COLORS[t.status] || "#818cf8" }}>{t.status.replace("_"," ")}</span></td>
                  <td style={S.td}>{new Date(t.createdAt).toLocaleDateString("en-IN")}</td>
                  <td style={S.td}>
                    {t.status === "OPEN" && <button onClick={() => updateStatus(t.id, "IN_PROGRESS")} style={{ background: "#f59e0b20", color: "#f59e0b", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>Start</button>}
                    {t.status === "IN_PROGRESS" && <button onClick={() => updateStatus(t.id, "RESOLVED")} style={{ background: "#10b98120", color: "#10b981", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>Resolve</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Support Ticket</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Subject *</label><input style={S.input} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              <div><label style={S.label}>Description *</label><textarea style={{ ...S.input, minHeight: 80, resize: "vertical" as const }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid-r2">
                <div><label style={S.label}>Priority</label>
                  <select style={S.select} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {Object.keys(PRIORITY_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Customer</label>
                  <select style={S.select} value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                    <option value="">— Select —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={save} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Create Ticket"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
