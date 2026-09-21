import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { PackageOpen, Plus, Search, X, Check, Clock, Truck } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  btn: { background: "linear-gradient(135deg,#10b981,#059669)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)", verticalAlign: "top" as const },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "16px" },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
};

const UNITS = ["PCS", "KG", "MT", "LTR", "BOX", "BAG", "ROLL", "BUNDLE", "PAIR", "SET", "DOZEN", "TON"];
const STATUS_COLORS: Record<string, string> = { PENDING: "#f59e0b", COMPLETED: "#10b981", CANCELLED: "#ef4444" };

interface GoodsEntry {
  id: string; entryNumber: string; direction: string; entryDate: string; entryTime?: string;
  materialName: string; quantity: number; unit: string; partyName?: string; vehicleNumber?: string;
  personName?: string; remarks?: string; referenceNo?: string; status: string;
  party?: { id: string; name: string } | null;
}
interface Party { id: string; name: string; }

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  entryTime: new Date().toTimeString().slice(0, 5),
  materialName: "", quantity: "", unit: "PCS",
  partyName: "", partyId: "", vehicleNumber: "",
  personName: "", remarks: "", referenceNo: "",
};

export default function StorePage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<GoodsEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...emptyForm });

  const load = useCallback(async () => {
    setLoading(true);
    const [eRes, pRes] = await Promise.allSettled([
      api.get(`/goods-entries?direction=INWARD&search=${search}&limit=200`),
      api.get("/parties?limit=300"),
    ]);
    if (eRes.status === "fulfilled") setEntries(eRes.value.data.data || []);
    if (pRes.status === "fulfilled") setParties(pRes.value.data.data.parties || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openModal = () => {
    setForm({ ...emptyForm, entryDate: new Date().toISOString().slice(0, 10), entryTime: new Date().toTimeString().slice(0, 5) });
    setError("");
    setShowModal(true);
  };

  const save = async () => {
    if (!form.materialName || !form.quantity) { setError("Material name and quantity are required."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/goods-entries", { ...form, direction: "INWARD", quantity: parseFloat(form.quantity) });
      setShowModal(false);
      load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed to save"); }
    setSaving(false);
  };

  const markComplete = async (id: string) => {
    try { await api.patch(`/goods-entries/${id}`, { status: "COMPLETED" }); load(); } catch { }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    try { await api.delete(`/goods-entries/${id}`); load(); } catch { }
  };

  const todayEntries = entries.filter(e => new Date(e.entryDate).toDateString() === new Date().toDateString());
  const totalQtyToday = todayEntries.reduce((s, e) => s + e.quantity, 0);

  return (
    <div className="page-pad">
      {/* Header */}
      <div className="page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <PackageOpen size={20} color="#10b981" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_store') }</h1>
            <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2 }}>Record all incoming materials and goods received at store</p>
          </div>
        </div>
        <div className="hdr-actions">
          <button style={S.btn} onClick={openModal}><Plus size={15} /> New Inward Entry</button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="summary-grid">
        {[
          { label: "Today's Receipts", value: todayEntries.length, color: "#10b981" },
          { label: "Total Entries", value: entries.length, color: "#818cf8" },
          { label: "Today's Qty", value: totalQtyToday.toLocaleString("en-IN"), color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>{k.label}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
            <input
              style={{ ...S.input, paddingLeft: 34 }}
              placeholder="Search material, party, vehicle, GRN#..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <PackageOpen size={40} color="var(--border)" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ color: "var(--text-ghost)", margin: 0 }}>No inward entries yet. Click "New Inward Entry" to record material receipt.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["GRN #", "Date & Time", "Material / Description", "Qty", "Party / Supplier", "Vehicle", "Received By", "Ref #", "Status", ""].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const sc = STATUS_COLORS[e.status] || "#818cf8";
                  return (
                    <tr key={e.id}
                      onMouseEnter={ev => (ev.currentTarget.style.background = "#0A0A1A")}
                      onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
                      <td style={{ ...S.td, color: "#10b981", fontWeight: 700, whiteSpace: "nowrap" }}>{e.entryNumber}</td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                        <div>{new Date(e.entryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                        {e.entryTime && <div style={{ fontSize: 11, color: "var(--text-ghost)", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}><Clock size={10} />{e.entryTime}</div>}
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{e.materialName}</div>
                        {e.remarks && <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{e.remarks}</div>}
                      </td>
                      <td style={{ ...S.td, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {e.quantity.toLocaleString("en-IN")} <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>{e.unit}</span>
                      </td>
                      <td style={S.td}>{e.partyName || e.party?.name || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                      <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{e.vehicleNumber || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                      <td style={S.td}>{e.personName || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                      <td style={{ ...S.td, fontSize: 11, color: "#818cf8" }}>{e.referenceNo || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                      <td style={S.td}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc + "20", color: sc }}>
                          {e.status}
                        </span>
                      </td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {e.status === "PENDING" && (
                            <button onClick={() => markComplete(e.id)}
                              title="Mark Completed"
                              style={{ background: "#10b98120", color: "#10b981", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                              <Check size={11} /> Done
                            </button>
                          )}
                          <button onClick={() => deleteEntry(e.id)}
                            style={{ background: "#ef444420", color: "#ef4444", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer" }}>
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PackageOpen size={18} color="#10b981" />
                <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Inward Entry (GRN)</h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "9px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Date + Time */}
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Date *</label>
                  <input type="date" style={S.input} value={form.entryDate} onChange={e => set("entryDate", e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Time</label>
                  <input type="time" style={S.input} value={form.entryTime} onChange={e => set("entryTime", e.target.value)} />
                </div>
              </div>

              {/* Material */}
              <div>
                <label style={S.label}>Material / Item Name *</label>
                <input style={S.input} placeholder="e.g. Cotton Fabric, Steel Pipes..." value={form.materialName} onChange={e => set("materialName", e.target.value)} />
              </div>

              {/* Qty + Unit */}
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Quantity *</label>
                  <input type="number" style={S.input} placeholder="0" min="0" step="any" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Unit</label>
                  <select style={S.select} value={form.unit} onChange={e => set("unit", e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Party */}
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Supplier / Party (CRM)</label>
                  <select style={S.select} value={form.partyId}
                    onChange={e => {
                      const p = parties.find(x => x.id === e.target.value);
                      set("partyId", e.target.value);
                      if (p) set("partyName", p.name);
                    }}>
                    <option value="">— Select Party —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Or type party name</label>
                  <input style={S.input} placeholder="Supplier name (free text)" value={form.partyName} onChange={e => { set("partyName", e.target.value); set("partyId", ""); }} />
                </div>
              </div>

              {/* Vehicle + Person */}
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Vehicle Number</label>
                  <input style={S.input} placeholder="e.g. GJ05AB1234" value={form.vehicleNumber} onChange={e => set("vehicleNumber", e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Received By</label>
                  <input style={S.input} placeholder="Staff name" value={form.personName} onChange={e => set("personName", e.target.value)} />
                </div>
              </div>

              {/* Reference + Remarks */}
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Reference # (PO / Challan / Bill)</label>
                  <input style={S.input} placeholder="PO-0023 / Challan No." value={form.referenceNo} onChange={e => set("referenceNo", e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Remarks / Description</label>
                  <input style={S.input} placeholder="Additional notes..." value={form.remarks} onChange={e => set("remarks", e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={save} style={S.btn} disabled={saving}>
                {saving ? "Saving..." : <><PackageOpen size={14} /> Record Receipt</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
