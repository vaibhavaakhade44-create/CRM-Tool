import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Globe, Plus, Search, X, FileText, Package, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" as const },
  searchWrap: { position: "relative" as const, flex: 1, maxWidth: 280 },
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  searchIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 580, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  filterSel: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none", colorScheme: "dark" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 } as React.CSSProperties,
};

const DOC_TYPES = ["BILL_OF_LADING","LETTER_OF_CREDIT","COMMERCIAL_INVOICE","PACKING_LIST","CERTIFICATE_OF_ORIGIN","INSURANCE_CERTIFICATE","SHIPPING_BILL","BILL_OF_ENTRY","OTHER"];
const TYPE_LABELS: Record<string,string> = { BILL_OF_LADING:"Bill of Lading", LETTER_OF_CREDIT:"Letter of Credit", COMMERCIAL_INVOICE:"Comm. Invoice", PACKING_LIST:"Packing List", CERTIFICATE_OF_ORIGIN:"Cert of Origin", INSURANCE_CERTIFICATE:"Insurance", SHIPPING_BILL:"Shipping Bill", BILL_OF_ENTRY:"Bill of Entry", OTHER:"Other" };
const TYPE_COLORS: Record<string,string> = { BILL_OF_LADING:"#6366f1", LETTER_OF_CREDIT:"#f59e0b", COMMERCIAL_INVOICE:"#10b981", PACKING_LIST:"#60a5fa", CERTIFICATE_OF_ORIGIN:"#a78bfa", INSURANCE_CERTIFICATE:"#34d399", SHIPPING_BILL:"#fb923c", BILL_OF_ENTRY:"#f472b6", OTHER:"#6b7280" };
const STATUS_COLORS: Record<string,string> = { DRAFT:"#818cf8", SUBMITTED:"#60a5fa", APPROVED:"#10b981", REJECTED:"#ef4444", EXPIRED:"#6b7280" };
const STATUSES = ["DRAFT","SUBMITTED","APPROVED","REJECTED","EXPIRED"];
const CURRENCIES = ["USD","EUR","GBP","INR","AED","SGD","JPY","CNY","AUD","CAD"];
const INCOTERMS = ["EXW","FCA","FAS","FOB","CFR","CIF","CPT","CIP","DAP","DPU","DDP"];

interface Doc { id: string; documentNumber: string; type: string; status: string; documentDate: string; expiryDate?: string; amount?: number; currency: string; portOfLoading?: string; portOfDischarge?: string; vessel?: string; country?: string; flightNumber?: string; description?: string; notes?: string; partyId?: string; party?: { id: string; name: string } | null; }
interface Summary { total: number; expiringSoon: number; byType: Array<{ type: string; _count: number }>; }
interface Party { id: string; name: string; }

const emptyForm = { partyId:"", type:"BILL_OF_LADING", documentNumber:"", documentDate:"", expiryDate:"", country:"", portOfLoading:"", portOfDischarge:"", vessel:"", flightNumber:"", incoterm:"", amount:"", currency:"USD", description:"", notes:"", status:"DRAFT" };

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ padding:"2px 8px", borderRadius:5, fontSize:11, fontWeight:600, background:color+"20", color }}>{text.replace(/_/g," ")}</span>;
}

export default function TradePage() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [summary, setSummary] = useState<Summary|null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...emptyForm });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, pRes, sRes] = await Promise.all([
        api.get(`/trade?search=${search}&type=${typeFilter}&status=${statusFilter}&limit=100`),
        api.get("/parties?limit=200"),
        api.get("/trade/summary"),
      ]);
      setDocs(dRes.data.data.docs || []);
      setParties(pRes.data.data?.parties || []);
      setSummary(sRes.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Also load parties separately for the dropdown
  useEffect(() => {
    api.get("/parties?limit=500").then(r => setParties(r.data.data?.parties || [])).catch(() => {});
  }, []);

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setError(""); setShowModal(true); };

  const openEdit = (d: Doc) => {
    setEditId(d.id);
    setForm({
      partyId: d.partyId || d.party?.id || "",
      type: d.type, documentNumber: d.documentNumber,
      documentDate: new Date(d.documentDate).toISOString().slice(0,10),
      expiryDate: d.expiryDate ? new Date(d.expiryDate).toISOString().slice(0,10) : "",
      country: d.country || "", portOfLoading: d.portOfLoading || "", portOfDischarge: d.portOfDischarge || "",
      vessel: d.vessel || "", flightNumber: d.flightNumber || "", incoterm: "",
      amount: d.amount ? String(d.amount) : "", currency: d.currency,
      description: d.description || "", notes: d.notes || "", status: d.status,
    });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const payload: Record<string, unknown> = {
        partyId: form.partyId || undefined, type: form.type, documentNumber: form.documentNumber,
        documentDate: form.documentDate || undefined, expiryDate: form.expiryDate || undefined,
        country: form.country || undefined, portOfLoading: form.portOfLoading || undefined,
        portOfDischarge: form.portOfDischarge || undefined, vessel: form.vessel || undefined,
        flightNumber: form.flightNumber || undefined, amount: form.amount ? parseFloat(form.amount) : undefined,
        currency: form.currency, description: form.description || undefined, notes: form.notes || undefined,
      };
      if (editId) {
        await api.patch(`/trade/${editId}`, payload);
        // Update status separately if changed
        const original = docs.find(d => d.id === editId);
        if (original && original.status !== form.status) {
          await api.patch(`/trade/${editId}/status`, { status: form.status });
        }
      } else {
        await api.post("/trade", payload);
      }
      setShowModal(false); load();
    } catch (e: unknown) { setError((e as {response?:{data?:{message?:string}}})?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const quickStatus = async (id: string, status: string) => {
    setUpdatingStatus(true);
    try { await api.patch(`/trade/${id}/status`, { status }); load(); }
    catch { /* ignore */ }
    setUpdatingStatus(false);
  };

  const f = (k: keyof typeof emptyForm, v: string) => setForm(p => ({ ...p, [k]:v }));

  const approved = docs.filter(d => d.status === "APPROVED").length;
  const pending = docs.filter(d => d.status === "DRAFT" || d.status === "SUBMITTED").length;

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>Import / Export Suite</h1>
          <p style={S.subtitle}>Trade documents, shipping, and customs management</p>
        </div>
        <button style={S.btn} onClick={openNew}><Plus size={15}/> New Document</button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label:"Total Documents", value:summary?.total ?? docs.length, icon:<Globe size={18} color="#6366f1"/>, color:"#6366f1" },
          { label:"Approved", value:approved, icon:<CheckCircle size={18} color="#10b981"/>, color:"#10b981" },
          { label:"Pending / Draft", value:pending, icon:<Clock size={18} color="#f59e0b"/>, color:"#f59e0b" },
          { label:"Expiring in 30 days", value:summary?.expiringSoon ?? 0, icon:<AlertTriangle size={18} color="#ef4444"/>, color:"#ef4444" },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, color:"var(--text-ghost)", fontWeight:500 }}>{k.label}</span>
              <div style={{ padding:6, borderRadius:8, background:k.color+"20" }}>{k.icon}</div>
            </div>
            <div style={{ fontSize:26, fontWeight:700, color:"var(--text-primary)", marginTop:4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Type Filter Chips */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" as const }}>
        <button onClick={() => setTypeFilter("")} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${!typeFilter ? "#6366f1" : "var(--border)"}`, background:!typeFilter ? "#6366f120" : "transparent", color:!typeFilter ? "#818CF8" : "var(--text-ghost)", cursor:"pointer", fontSize:11, fontWeight:600 }}>All Types</button>
        {DOC_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(typeFilter===t ? "" : t)} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${typeFilter===t ? TYPE_COLORS[t] : TYPE_COLORS[t]+"40"}`, background:typeFilter===t ? TYPE_COLORS[t]+"25" : "transparent", color:typeFilter===t ? TYPE_COLORS[t] : TYPE_COLORS[t]+"cc", cursor:"pointer", fontSize:11, fontWeight:600 }}>
            <FileText size={11} style={{ display:"inline", marginRight:4 }}/>{TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <Search size={14} style={S.searchIcon}/>
            <input style={S.searchInput} placeholder="Search doc #, vessel, port..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select style={S.filterSel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-ghost)" }}>{docs.length} document{docs.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--text-ghost)" }}>Loading...</div> : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Doc Number","Type","Party","Date","Expiry","Route","Amount","Status","Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {docs.length === 0
                ? <tr><td colSpan={9} style={{ ...S.td, textAlign:"center", color:"var(--text-ghost)", padding:40 }}>No documents. Create your first trade document.</td></tr>
                : docs.map(d => {
                  const isExpiringSoon = d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 30*86400000) && new Date(d.expiryDate) > new Date();
                  const isExpired = d.expiryDate && new Date(d.expiryDate) < new Date();
                  return (
                    <tr key={d.id} onClick={() => openEdit(d)} style={{ cursor:"pointer" }}>
                      <td style={{ ...S.td, color:"#818CF8", fontWeight:600, fontFamily:"monospace" }}>{d.documentNumber}</td>
                      <td style={S.td}><Badge text={TYPE_LABELS[d.type]||d.type} color={TYPE_COLORS[d.type]||"#818cf8"}/></td>
                      <td style={S.td}>{d.party?.name || "—"}</td>
                      <td style={S.td}>{new Date(d.documentDate).toLocaleDateString("en-IN")}</td>
                      <td style={{ ...S.td, color: isExpired ? "#ef4444" : isExpiringSoon ? "#f59e0b" : "var(--text-sec)" }}>
                        {d.expiryDate ? (
                          <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                            {(isExpired||isExpiringSoon) && <AlertTriangle size={11}/>}
                            {new Date(d.expiryDate).toLocaleDateString("en-IN")}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ ...S.td, fontSize:12 }}>
                        {d.portOfLoading || d.portOfDischarge ? `${d.portOfLoading||"?"} → ${d.portOfDischarge||"?"}` : d.vessel || "—"}
                      </td>
                      <td style={S.td}>{d.amount ? `${d.currency} ${d.amount.toLocaleString()}` : "—"}</td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <select
                          value={d.status}
                          disabled={updatingStatus}
                          onChange={e => quickStatus(d.id, e.target.value)}
                          style={{ background:"transparent", border:"none", color:STATUS_COLORS[d.status]||"var(--text-sec)", fontSize:11, fontWeight:600, cursor:"pointer", outline:"none", colorScheme:"dark" }}
                        >
                          {STATUSES.map(s => <option key={s} value={s} style={{ background:"var(--bg-hover)", color:STATUS_COLORS[s]||"var(--text-sec)" }}>{s}</option>)}
                        </select>
                      </td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(d)} style={{ background:"none", border:"none", color:"#6366f1", cursor:"pointer", fontSize:12, fontWeight:600 }}>Edit</button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Type Breakdown */}
      {summary && summary.byType.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {summary.byType.sort((a,b) => b._count - a._count).map(t => (
            <div key={t.type} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:TYPE_COLORS[t.type]||"#818cf8", flexShrink:0 }}/>
                <span style={{ fontSize:12, color:"var(--text-sec)" }}>{TYPE_LABELS[t.type]||t.type}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:TYPE_COLORS[t.type]||"#818cf8" }}>{t._count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={S.modal} onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal-inner">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ color:"var(--text-primary)", margin:0, fontSize:16, fontWeight:700 }}>{editId ? "Edit Document" : "New Trade Document"}</h3>
              <button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", color:"var(--text-ghost)", cursor:"pointer" }}><X size={18}/></button>
            </div>
            {error && <div style={{ background:"#ef444420", border:"1px solid #ef4444", borderRadius:8, padding:"8px 12px", color:"#ef4444", fontSize:12, marginBottom:14 }}>{error}</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>Document Type</label>
                  <select style={S.select} value={form.type} onChange={e => f("type", e.target.value)}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Document Number *</label><input style={S.input} value={form.documentNumber} onChange={e => f("documentNumber", e.target.value)} placeholder="e.g. BL-2024-001"/></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Party / Counterpart</label>
                  <select style={S.select} value={form.partyId} onChange={e => f("partyId", e.target.value)}>
                    <option value="">— Select —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {editId && (
                  <div><label style={S.label}>Status</label>
                    <select style={S.select} value={form.status} onChange={e => f("status", e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Document Date</label><input type="date" style={S.input} value={form.documentDate} onChange={e => f("documentDate", e.target.value)}/></div>
                <div><label style={S.label}>Expiry Date</label><input type="date" style={S.input} value={form.expiryDate} onChange={e => f("expiryDate", e.target.value)}/></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Port of Loading</label><input style={S.input} value={form.portOfLoading} onChange={e => f("portOfLoading", e.target.value)} placeholder="e.g. INNHAVA (JNPT)"/></div>
                <div><label style={S.label}>Port of Discharge</label><input style={S.input} value={form.portOfDischarge} onChange={e => f("portOfDischarge", e.target.value)} placeholder="e.g. USNYLC"/></div>
              </div>
              <div className="grid-r3">
                <div><label style={S.label}>Vessel / Flight</label><input style={S.input} value={form.vessel} onChange={e => f("vessel", e.target.value)} placeholder="MV Neptune"/></div>
                <div><label style={S.label}>Incoterm</label>
                  <select style={S.select} value={form.incoterm} onChange={e => f("incoterm", e.target.value)}>
                    <option value="">—</option>
                    {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Country</label><input style={S.input} value={form.country} onChange={e => f("country", e.target.value)} placeholder="Origin country"/></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Amount</label><input type="number" style={S.input} value={form.amount} onChange={e => f("amount", e.target.value)} min="0"/></div>
                <div><label style={S.label}>Currency</label>
                  <select style={S.select} value={form.currency} onChange={e => f("currency", e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={S.label}>Description / Notes</label><textarea style={{ ...S.input, minHeight:60, resize:"vertical" as const }} value={form.notes} onChange={e => f("notes", e.target.value)}/></div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background:"var(--border)", color:"var(--text-sec)" }}>Cancel</button>
              <button onClick={save} style={S.btn} disabled={saving}>{saving ? "Saving..." : editId ? "Update" : "Create Document"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
