import { useState, useEffect, useCallback } from "react";
import DocumentsButton from "@/components/DocumentsButton";
import api from "@/lib/api";
import { Truck, Plus, Search, X, Check, Clock, Package, ClipboardList } from "lucide-react";
import { kDecimal } from "@/lib/fieldRules";
import { useTranslation } from 'react-i18next';

const S = {
  btnPrimary: { background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  btnSecondary: { background: "var(--bg-hover)", border: "none", color: "var(--text-sec)", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  btnIndig: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)", verticalAlign: "top" as const },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
};

const UNITS = ["PCS", "KG", "MT", "LTR", "BOX", "BAG", "ROLL", "BUNDLE", "PAIR", "SET", "DOZEN", "TON"];
const SO_COLORS: Record<string, string> = { DRAFT: "#818cf8", CONFIRMED: "#60a5fa", PROCESSING: "#f59e0b", DISPATCHED: "#a78bfa", DELIVERED: "#10b981", CANCELLED: "#ef4444" };
const SHP_COLORS: Record<string, string> = { PENDING: "#818cf8", PACKED: "#60a5fa", SHIPPED: "#f59e0b", IN_TRANSIT: "#a78bfa", DELIVERED: "#10b981", RETURNED: "#ef4444" };
const DSP_COLORS: Record<string, string> = { PENDING: "#f59e0b", COMPLETED: "#10b981", CANCELLED: "#ef4444" };

interface GoodsEntry {
  id: string; entryNumber: string; entryDate: string; entryTime?: string;
  materialName: string; quantity: number; unit: string; partyName?: string;
  vehicleNumber?: string; personName?: string; remarks?: string; referenceNo?: string; status: string;
  party?: { id: string; name: string } | null;
}
interface SO { id: string; soNumber: string; status: string; orderDate: string; total: number; party?: { name: string } | null; _count?: { items: number }; }
interface Shipment { id: string; shipmentNumber: string; status: string; carrier?: string; trackingNumber?: string; shipDate?: string; salesOrder?: { soNumber: string; party?: { name: string } | null } | null; }
interface Product { id: string; name: string; sku: string; sellingPrice: number; }
interface Party { id: string; name: string; }

const emptyDispatchForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  entryTime: new Date().toTimeString().slice(0, 5),
  materialName: "", quantity: "", unit: "PCS",
  partyName: "", partyId: "", vehicleNumber: "",
  personName: "", remarks: "", referenceNo: "",
};
const emptySOItem = { description: "", productId: "", quantity: "1", unitPrice: "", taxRate: "18", discount: "0" };

export default function SalesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"dispatch" | "orders" | "shipments">("dispatch");
  const [dispatches, setDispatches] = useState<GoodsEntry[]>([]);
  const [orders, setOrders] = useState<SO[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showSOModal, setShowSOModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dForm, setDForm] = useState({ ...emptyDispatchForm });
  const [soForm, setSOForm] = useState({ partyId: "", orderDate: "", expectedDate: "", shippingAddress: "", shippingCharge: "0", notes: "" });
  const [soItems, setSOItems] = useState([{ ...emptySOItem }]);
  const [shipForm, setShipForm] = useState({ salesOrderId: "", carrier: "", trackingNumber: "", shipDate: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, soRes, shpRes, partyRes] = await Promise.allSettled([
      api.get(`/goods-entries?direction=OUTWARD&search=${tab === "dispatch" ? search : ""}&limit=200`),
      api.get(`/sales-orders?search=${tab === "orders" ? search : ""}&limit=100`),
      api.get("/sales-orders/shipments?limit=100"),
      api.get("/parties?limit=300"),
    ]);
    if (dRes.status === "fulfilled") setDispatches(dRes.value.data.data || []);
    if (soRes.status === "fulfilled") setOrders(soRes.value.data.data.orders || []);
    if (shpRes.status === "fulfilled") setShipments(shpRes.value.data.data.shipments || []);
    if (partyRes.status === "fulfilled") setParties(partyRes.value.data.data.parties || []);
    setLoading(false);
  }, [search, tab]);

  useEffect(() => { load(); }, [load]);

  const loadProducts = async () => {
    try { const r = await api.get("/inventory?limit=500"); setProducts(r.data.data?.products || r.data.data || []); } catch { }
  };

  const setD = (k: string, v: string) => setDForm(p => ({ ...p, [k]: v }));

  const openDispatchModal = () => {
    setDForm({ ...emptyDispatchForm, entryDate: new Date().toISOString().slice(0, 10), entryTime: new Date().toTimeString().slice(0, 5) });
    setError(""); setShowDispatchModal(true);
  };

  const saveDispatch = async () => {
    if (!dForm.materialName || !dForm.quantity) { setError("Material name and quantity are required."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/goods-entries", { ...dForm, direction: "OUTWARD", quantity: parseFloat(dForm.quantity) });
      setShowDispatchModal(false); load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const markDone = async (id: string) => { try { await api.patch(`/goods-entries/${id}`, { status: "COMPLETED" }); load(); } catch { } };
  const deleteDispatch = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    try { await api.delete(`/goods-entries/${id}`); load(); } catch { }
  };

  const openSOModal = () => { loadProducts(); setSOForm({ partyId: "", orderDate: "", expectedDate: "", shippingAddress: "", shippingCharge: "0", notes: "" }); setSOItems([{ ...emptySOItem }]); setError(""); setShowSOModal(true); };
  const setSOItem = (i: number, k: string, v: string) => setSOItems(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const setSOItemProduct = (i: number, pid: string) => { const p = products.find(x => x.id === pid); setSOItems(prev => prev.map((it, j) => j === i ? { ...it, productId: pid, description: p?.name || "", unitPrice: String(p?.sellingPrice || "") } : it)); };
  const soTotal = soItems.reduce((s, it) => { const line = parseFloat(it.quantity || "0") * parseFloat(it.unitPrice || "0"); return s + (line - line * parseFloat(it.discount || "0") / 100) * (1 + parseFloat(it.taxRate || "0") / 100); }, 0) + parseFloat(soForm.shippingCharge || "0");

  const saveSO = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/sales-orders", { partyId: soForm.partyId || undefined, orderDate: soForm.orderDate || undefined, expectedDate: soForm.expectedDate || undefined, shippingAddress: soForm.shippingAddress || undefined, shippingCharge: parseFloat(soForm.shippingCharge) || 0, notes: soForm.notes || undefined, items: soItems.map(it => ({ productId: it.productId || undefined, description: it.description, quantity: parseFloat(it.quantity), unitPrice: parseFloat(it.unitPrice), taxRate: parseFloat(it.taxRate), discount: parseFloat(it.discount) })) });
      setShowSOModal(false); load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const saveShipment = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/sales-orders/shipments", { ...shipForm, salesOrderId: shipForm.salesOrderId || undefined, shipDate: shipForm.shipDate || undefined });
      setShowShipModal(false); load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const updateSOStatus = async (id: string, status: string) => { try { await api.patch(`/sales-orders/${id}/status`, { status }); load(); } catch { } };
  const updateShipStatus = async (id: string, status: string) => { try { await api.patch(`/sales-orders/shipments/${id}/status`, { status }); load(); } catch { } };

  const todayDispatches = dispatches.filter(e => new Date(e.entryDate).toDateString() === new Date().toDateString());

  const tabBtn = (key: typeof tab, icon: React.ReactNode, label: string, count: number) => (
    <button key={key} onClick={() => setTab(key)} style={{
      padding: "9px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 6,
      background: tab === key ? "rgba(245,158,11,0.15)" : "transparent",
      color: tab === key ? "#f59e0b" : "var(--text-ghost)",
      borderBottom: tab === key ? "2px solid #f59e0b" : "2px solid transparent",
      transition: "all 0.15s", whiteSpace: "nowrap" as const,
    }}>
      {icon} {label} <span style={{ fontSize: 11, opacity: 0.7 }}>({count})</span>
    </button>
  );

  return (
    <div className="page-pad">
      {/* Header */}
      <div className="page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Truck size={20} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Dispatch — Outward Register</h1>
            <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2 }}>Record outgoing goods, manage sales orders and track shipments</p>
          </div>
        </div>
        <div className="hdr-actions">
          {tab === "dispatch" && <button style={S.btnPrimary} onClick={openDispatchModal}><Plus size={14} /> New Dispatch</button>}
          {tab === "orders" && <button style={S.btnIndig} onClick={openSOModal}><Plus size={14} /> New Sales Order</button>}
          {tab === "shipments" && <button style={S.btnSecondary} onClick={() => { setError(""); setShipForm({ salesOrderId: "", carrier: "", trackingNumber: "", shipDate: "", notes: "" }); setShowShipModal(true); }}><Truck size={14} /> New Shipment</button>}
        </div>
      </div>

      {/* Summary (Dispatch tab only) */}
      {tab === "dispatch" && (
        <div className="summary-grid">
          {[
            { label: "Today's Dispatches", value: todayDispatches.length, color: "#f59e0b" },
            { label: "Total Entries", value: dispatches.length, color: "#818cf8" },
            { label: "Pending", value: dispatches.filter(e => e.status === "PENDING").length, color: "#ef4444" },
          ].map(k => (
            <div key={k.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>{k.label}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {tabBtn("dispatch", <ClipboardList size={14} />, "Dispatch Register", dispatches.length)}
        {tabBtn("orders", <Package size={14} />, "Sales Orders", orders.length)}
        {tabBtn("shipments", <Truck size={14} />, "Shipments", shipments.length)}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
          <input style={{ ...S.input, paddingLeft: 34, background: "var(--bg-card)", border: "1px solid var(--border)" }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (

          tab === "dispatch" ? (
            dispatches.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <Truck size={40} color="var(--border)" style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ color: "var(--text-ghost)", margin: 0 }}>No dispatch entries yet. Click "New Dispatch" to record outgoing goods.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["DSP #", "Date & Time", "Material / Description", "Qty", "Party / Customer", "Vehicle", "Dispatched By", "Ref #", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {dispatches.map(e => {
                      const sc = DSP_COLORS[e.status] || "#818cf8";
                      return (
                        <tr key={e.id}
                          onMouseEnter={ev => (ev.currentTarget.style.background = "#0A0A1A")}
                          onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
                          <td style={{ ...S.td, color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap" }}>{e.entryNumber}</td>
                          <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                            <div>{new Date(e.entryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                            {e.entryTime && <div style={{ fontSize: 11, color: "var(--text-ghost)", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}><Clock size={10} />{e.entryTime}</div>}
                          </td>
                          <td style={S.td}>
                            <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{e.materialName}</div>
                            {e.remarks && <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{e.remarks}</div>}
                          </td>
                          <td style={{ ...S.td, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{e.quantity.toLocaleString("en-IN")} <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>{e.unit}</span></td>
                          <td style={S.td}>{e.partyName || e.party?.name || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                          <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{e.vehicleNumber || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                          <td style={S.td}>{e.personName || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                          <td style={{ ...S.td, fontSize: 11, color: "#818cf8" }}>{e.referenceNo || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                          <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc + "20", color: sc }}>{e.status}</span></td>
                          <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              {e.status === "PENDING" && <button onClick={() => markDone(e.id)} title="Mark Completed" style={{ background: "#10b98120", color: "#10b981", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}><Check size={11} /> Done</button>}
                              <DocumentsButton entityType="GOODS_ENTRY" entityId={e.id} entityLabel={e.entryNumber} />
                              <button onClick={() => deleteDispatch(e.id)} style={{ background: "#ef444420", color: "#ef4444", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer" }}><X size={11} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) :

          tab === "orders" ? (
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["SO #", "Customer", "Date", "Items", "Total", "Status", "Action"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.length === 0 ? <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No sales orders yet.</td></tr> : orders.map(so => (
                    <tr key={so.id}>
                      <td style={{ ...S.td, color: "#818CF8", fontWeight: 600 }}>{so.soNumber}</td>
                      <td style={S.td}>{so.party?.name || "—"}</td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>{new Date(so.orderDate).toLocaleDateString("en-IN")}</td>
                      <td style={S.td}>{so._count?.items || 0}</td>
                      <td style={{ ...S.td, fontWeight: 600, color: "var(--text-primary)" }}>₹{so.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                      <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (SO_COLORS[so.status] || "#818cf8") + "20", color: SO_COLORS[so.status] || "#818cf8" }}>{so.status}</span></td>
                      <td style={S.td}>
                        {so.status === "DRAFT" && <button onClick={() => updateSOStatus(so.id, "CONFIRMED")} style={{ background: "#60a5fa20", color: "#60a5fa", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Confirm</button>}
                        {so.status === "CONFIRMED" && <button onClick={() => updateSOStatus(so.id, "PROCESSING")} style={{ background: "#f59e0b20", color: "#f59e0b", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Process</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Shipment #", "Order", "Customer", "Carrier", "Tracking", "Ship Date", "Status", "Action"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {shipments.length === 0 ? <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No shipments yet.</td></tr> : shipments.map(s => (
                    <tr key={s.id}>
                      <td style={{ ...S.td, color: "#818CF8", fontWeight: 600 }}>{s.shipmentNumber}</td>
                      <td style={S.td}>{s.salesOrder?.soNumber || "—"}</td>
                      <td style={S.td}>{s.salesOrder?.party?.name || "—"}</td>
                      <td style={S.td}>{s.carrier || "—"}</td>
                      <td style={S.td}><span style={{ fontFamily: "monospace", color: "#818CF8" }}>{s.trackingNumber || "—"}</span></td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>{s.shipDate ? new Date(s.shipDate).toLocaleDateString("en-IN") : "—"}</td>
                      <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (SHP_COLORS[s.status] || "#818cf8") + "20", color: SHP_COLORS[s.status] || "#818cf8" }}>{s.status}</span></td>
                      <td style={S.td}>{s.status !== "DELIVERED" && <button onClick={() => updateShipStatus(s.id, "DELIVERED")} style={{ background: "#10b98120", color: "#10b981", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Delivered</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowDispatchModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Truck size={18} color="#f59e0b" />
                <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Dispatch Entry (DSP)</h3>
              </div>
              <button onClick={() => setShowDispatchModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "9px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>Date *</label><input type="date" style={S.input} value={dForm.entryDate} onChange={e => setD("entryDate", e.target.value)} /></div>
                <div><label style={S.label}>Time</label><input type="time" style={S.input} value={dForm.entryTime} onChange={e => setD("entryTime", e.target.value)} /></div>
              </div>
              <div>
                <label style={S.label}>Material / Goods Name *</label>
                <input style={S.input} placeholder="e.g. Cotton Shirts, Steel Rods..." value={dForm.materialName} onChange={e => setD("materialName", e.target.value)} />
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Quantity *</label><input type="number" style={S.input} placeholder="0" min="0" step="any" value={dForm.quantity} onChange={e => setD("quantity", e.target.value)} onKeyDown={kDecimal} /></div>
                <div><label style={S.label}>Unit</label>
                  <select style={S.select} value={dForm.unit} onChange={e => setD("unit", e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Customer / Party (CRM)</label>
                  <select style={S.select} value={dForm.partyId} onChange={e => { const p = parties.find(x => x.id === e.target.value); setD("partyId", e.target.value); if (p) setD("partyName", p.name); }}>
                    <option value="">— Select Party —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Or type party name</label>
                  <input style={S.input} placeholder="Customer name (free text)" value={dForm.partyName} onChange={e => { setD("partyName", e.target.value); setD("partyId", ""); }} />
                </div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Vehicle Number</label><input style={S.input} placeholder="e.g. GJ05AB1234" value={dForm.vehicleNumber} onChange={e => setD("vehicleNumber", e.target.value)} /></div>
                <div><label style={S.label}>Dispatched By</label><input style={S.input} placeholder="Staff name" value={dForm.personName} onChange={e => setD("personName", e.target.value)} /></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Reference # (SO / Challan)</label><input style={S.input} placeholder="SO-0023 / Challan No." value={dForm.referenceNo} onChange={e => setD("referenceNo", e.target.value)} /></div>
                <div><label style={S.label}>Remarks</label><input style={S.input} placeholder="Additional notes..." value={dForm.remarks} onChange={e => setD("remarks", e.target.value)} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setShowDispatchModal(false)} style={S.btnSecondary}>Cancel</button>
              <button onClick={saveDispatch} style={S.btnPrimary} disabled={saving}>{saving ? "Saving..." : <><Truck size={14} /> Record Dispatch</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Order Modal */}
      {showSOModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowSOModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Sales Order</h3>
              <button onClick={() => setShowSOModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "9px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>Customer</label>
                  <select style={S.select} value={soForm.partyId} onChange={e => setSOForm({ ...soForm, partyId: e.target.value })}>
                    <option value="">— Select Customer —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Order Date</label><input type="date" style={S.input} value={soForm.orderDate} onChange={e => setSOForm({ ...soForm, orderDate: e.target.value })} /></div>
              </div>
              <div><label style={S.label}>Shipping Address</label><input style={S.input} value={soForm.shippingAddress} onChange={e => setSOForm({ ...soForm, shippingAddress: e.target.value })} placeholder="Delivery address" /></div>
              <div>
                <label style={{ ...S.label, marginBottom: 10 }}>Items</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {soItems.map((it, i) => (
                    <div key={i} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <select style={S.select} value={it.productId} onChange={e => setSOItemProduct(i, e.target.value)}>
                          <option value="">— Product —</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input style={S.input} value={it.description} onChange={e => setSOItem(i, "description", e.target.value)} placeholder="Description" />
                        <div className="grid-r2">
                          <div><label style={{ ...S.label, marginBottom: 4 }}>Qty</label><input type="number" style={S.input} value={it.quantity} onChange={e => setSOItem(i, "quantity", e.target.value)} onKeyDown={kDecimal} /></div>
                          <div><label style={{ ...S.label, marginBottom: 4 }}>Rate ₹</label><input type="number" style={S.input} value={it.unitPrice} onChange={e => setSOItem(i, "unitPrice", e.target.value)} onKeyDown={kDecimal} /></div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ ...S.label, marginBottom: 4 }}>GST%</label>
                            <select style={S.select} value={it.taxRate} onChange={e => setSOItem(i, "taxRate", e.target.value)}>
                              {["0","5","12","18","28"].map(t => <option key={t} value={t}>{t}%</option>)}
                            </select>
                          </div>
                          <button onClick={() => setSOItems(p => p.filter((_, j) => j !== i))} style={{ background: "#ef444420", border: "none", color: "#ef4444", borderRadius: 6, padding: "9px 10px", cursor: "pointer" }}><X size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setSOItems(p => [...p, { ...emptySOItem }])} style={{ background: "var(--bg-hover)", border: "1px dashed #2a2a4a", color: "#818CF8", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}><Plus size={12} /> Add Item</button>
                </div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Shipping Charge ₹</label><input type="number" style={S.input} value={soForm.shippingCharge} onChange={e => setSOForm({ ...soForm, shippingCharge: e.target.value })} onKeyDown={kDecimal} /></div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                  <div><span style={{ color: "var(--text-ghost)", fontSize: 12 }}>Total: </span><span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 18 }}>₹{soTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setShowSOModal(false)} style={S.btnSecondary}>Cancel</button>
              <button onClick={saveSO} style={S.btnIndig} disabled={saving}>{saving ? "Saving..." : "Create Order"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Shipment Modal */}
      {showShipModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowShipModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Shipment</h3>
              <button onClick={() => setShowShipModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "9px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Link to Sales Order</label>
                <select style={S.select} value={shipForm.salesOrderId} onChange={e => setShipForm({ ...shipForm, salesOrderId: e.target.value })}>
                  <option value="">— Optional —</option>
                  {orders.filter(o => ["CONFIRMED","PROCESSING"].includes(o.status)).map(o => <option key={o.id} value={o.id}>{o.soNumber} – {o.party?.name || "?"}</option>)}
                </select>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Carrier</label><input style={S.input} value={shipForm.carrier} onChange={e => setShipForm({ ...shipForm, carrier: e.target.value })} placeholder="e.g. DTDC, Blue Dart" /></div>
                <div><label style={S.label}>Tracking Number</label><input style={S.input} value={shipForm.trackingNumber} onChange={e => setShipForm({ ...shipForm, trackingNumber: e.target.value })} /></div>
              </div>
              <div><label style={S.label}>Ship Date</label><input type="date" style={S.input} value={shipForm.shipDate} onChange={e => setShipForm({ ...shipForm, shipDate: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setShowShipModal(false)} style={S.btnSecondary}>Cancel</button>
              <button onClick={saveShipment} style={S.btnIndig} disabled={saving}>{saving ? "Saving..." : "Create Shipment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
