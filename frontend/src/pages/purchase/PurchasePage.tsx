import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import DocumentsButton from "@/components/DocumentsButton";
import { ShoppingBag, Plus, Search, X, ChevronDown } from "lucide-react";
import { kDecimal } from "@/lib/fieldRules";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16, alignItems: "center" } as React.CSSProperties,
  searchWrap: { position: "relative" as const, flex: 1, maxWidth: 300 },
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  searchIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
};

const STATUS_COLORS: Record<string, string> = { DRAFT: "#818cf8", SENT: "#60a5fa", PARTIAL: "#f59e0b", RECEIVED: "#10b981", CANCELLED: "#ef4444" };

interface PO { id: string; poNumber: string; status: string; orderDate: string; expectedDate?: string; total: number; party?: { name: string } | null; _count?: { items: number }; }
interface Product { id: string; name: string; sku: string; unit: string; costPrice: number; }
interface Party { id: string; name: string; }

const emptyItem = { description: "", productId: "", quantity: "1", unitPrice: "", taxRate: "18" };

export default function PurchasePage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<PO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ partyId: "", orderDate: "", expectedDate: "", notes: "" });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, partyRes] = await Promise.all([
        api.get(`/purchase-orders?search=${search}&status=${statusFilter}&limit=100`),
        api.get("/parties?limit=200"),
      ]);
      setOrders(ordRes.data.data.orders);
      setParties(partyRes.data.data.parties);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const loadProducts = async () => {
    try {
      const res = await api.get("/inventory?limit=500");
      setProducts(res.data.data.products);
    } catch { /* ignore */ }
  };

  const openModal = () => {
    loadProducts();
    setForm({ partyId: "", orderDate: "", expectedDate: "", notes: "" });
    setItems([{ ...emptyItem }]);
    setError(""); setShowModal(true);
  };

  const setItem = (i: number, key: string, val: string) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  };

  const setItemProduct = (i: number, pid: string) => {
    const p = products.find(x => x.id === pid);
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: pid, description: p?.name || "", unitPrice: String(p?.costPrice || "") } : it));
  };

  const total = items.reduce((s, it) => {
    const line = parseFloat(it.quantity || "0") * parseFloat(it.unitPrice || "0");
    return s + line + (line * parseFloat(it.taxRate || "0")) / 100;
  }, 0);

  const save = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/purchase-orders", {
        partyId: form.partyId || undefined,
        orderDate: form.orderDate || undefined,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        items: items.map(it => ({
          productId: it.productId || undefined,
          description: it.description,
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
          taxRate: parseFloat(it.taxRate),
        })),
      });
      setShowModal(false); load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed");
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try { await api.patch(`/purchase-orders/${id}/status`, { status }); load(); } catch { /* ignore */ }
  };

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Purchase & Procurement</h1>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2 }}>Manage purchase orders, vendor quotes and goods receipt</p>
        </div>
        <div className="hdr-actions">
          <button style={S.btn} onClick={openModal}><Plus size={15} /> New Purchase Order</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <Search size={14} style={S.searchIcon} />
            <input style={S.searchInput} placeholder="Search PO number, vendor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select style={{ ...S.select, width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
          <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["PO Number", "Vendor", "Date", "Expected", "Items", "Total", "Status", "Action"].map(h => <th key={h} style={{ ...S.th, whiteSpace: "nowrap" as const }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No purchase orders yet.</td></tr>
              ) : orders.map(po => (
                <tr key={po.id}>
                  <td style={{ ...S.td, color: "#818CF8", fontWeight: 600 }}>{po.poNumber}</td>
                  <td style={S.td}>{po.party?.name || "—"}</td>
                  <td style={S.td}>{new Date(po.orderDate).toLocaleDateString("en-IN")}</td>
                  <td style={S.td}>{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td style={S.td}>{po._count?.items || 0}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: "var(--text-primary)" }}>₹{po.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (STATUS_COLORS[po.status] || "#818cf8") + "20", color: STATUS_COLORS[po.status] || "#818cf8" }}>{po.status}</span></td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      {po.status === "DRAFT" && (<>
                        <button onClick={() => updateStatus(po.id, "SENT")} style={{ background: "#60a5fa20", color: "#60a5fa", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Send</button>
                        <button onClick={() => updateStatus(po.id, "RECEIVED")} style={{ background: "#10b98120", color: "#10b981", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Receive</button>
                      </>)}
                      {po.status === "SENT" && (
                        <button onClick={() => updateStatus(po.id, "RECEIVED")} style={{ background: "#10b98120", color: "#10b981", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Mark Received</button>
                      )}
                      <DocumentsButton entityType="PURCHASE_ORDER" entityId={po.id} entityLabel={po.poNumber} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Purchase Order</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>Vendor</label>
                  <select style={S.select} value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                    <option value="">— Select Vendor —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Order Date</label><input type="date" style={S.input} value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} /></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Expected Date</label><input type="date" style={S.input} value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></div>
              </div>

              {/* Items */}
              <div>
                <label style={{ ...S.label, marginBottom: 10 }}>Items</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                        <div>
                          <label style={{ ...S.label, marginBottom: 4 }}>Product / Description</label>
                          <select style={{ ...S.select, marginBottom: 4 }} value={it.productId} onChange={(e) => setItemProduct(i, e.target.value)}>
                            <option value="">— Product (optional) —</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <input style={S.input} value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} placeholder="Description" />
                        </div>
                        <div><label style={{ ...S.label, marginBottom: 4 }}>Qty</label><input type="number" style={S.input} value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} onKeyDown={kDecimal} /></div>
                        <div><label style={{ ...S.label, marginBottom: 4 }}>Rate (₹)</label><input type="number" style={S.input} value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", e.target.value)} onKeyDown={kDecimal} /></div>
                        <div><label style={{ ...S.label, marginBottom: 4 }}>GST %</label>
                          <select style={S.select} value={it.taxRate} onChange={(e) => setItem(i, "taxRate", e.target.value)}>
                            {["0","5","12","18","28"].map(t => <option key={t} value={t}>{t}%</option>)}
                          </select>
                        </div>
                        <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} style={{ background: "#ef444420", border: "none", color: "#ef4444", borderRadius: 6, padding: "6px 8px", cursor: "pointer", marginBottom: 0 }}><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setItems(prev => [...prev, { ...emptyItem }])} style={{ background: "var(--bg-hover)", border: "1px dashed #2a2a4a", color: "#818CF8", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    <Plus size={12} /> Add Item
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "var(--text-ghost)", fontSize: 12 }}>Total (incl. GST): </span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 16 }}>₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div><label style={S.label}>Notes</label><input style={S.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" /></div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={save} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Create PO"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
