import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Package, Plus, AlertTriangle, X, CalendarDays } from "lucide-react";
import { useTranslation } from 'react-i18next';
import ConfirmDialog from "@/components/ConfirmDialog";

const S = {
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
};

interface Batch {
  id: string;
  batchNumber: string;
  lotNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity: number;
  costPrice?: number;
  notes?: string;
  product: { id: string; name: string; sku: string; unit: string };
}

interface Product { id: string; name: string; sku: string; unit: string; }

const emptyForm = { productId: "", batchNumber: "", lotNumber: "", manufacturingDate: "", expiryDate: "", quantity: "", costPrice: "", notes: "" };

function daysUntil(date: string) {
  return Math.floor((new Date(date).getTime() - Date.now()) / 86400000);
}

function expiryColor(date?: string) {
  if (!date) return "var(--text-ghost)";
  const d = daysUntil(date);
  if (d < 0) return "#ef4444";
  if (d <= 7) return "#ef4444";
  if (d <= 30) return "#f59e0b";
  return "#10b981";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BatchTrackingPage() {
  const { t } = useTranslation();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<"all" | "expiring">("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [bRes, pRes] = await Promise.all([
        api.get(`/batches${tab === "expiring" ? "?expiringSoon=true" : ""}`),
        api.get("/inventory?limit=500"),
      ]);
      setBatches(bRes.data.data);
      setProducts(pRes.data.data?.products ?? []);
    } catch (e: any) {
      setLoadError(e?.response?.data?.message || "Failed to load batches.");
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.productId || !form.batchNumber || !form.quantity) { setError("Product, batch number and quantity are required"); return; }
    setSaving(true); setError("");
    try {
      await api.post("/batches", {
        productId: form.productId,
        batchNumber: form.batchNumber,
        lotNumber: form.lotNumber || undefined,
        manufacturingDate: form.manufacturingDate || undefined,
        expiryDate: form.expiryDate || undefined,
        quantity: parseFloat(form.quantity),
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        notes: form.notes || undefined,
      });
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed to save batch"); }
    setSaving(false);
  };

  const deleteBatch = async (id: string) => {
    try { await api.delete(`/batches/${id}`); } catch { }
    load();
    setConfirmDeleteId(null);
  };

  const expiringCount = batches.filter(b => b.expiryDate && daysUntil(b.expiryDate) <= 30).length;

  return (
    <div style={{ padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_batch_tracking') }</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-ghost)" }}>Track product batches, lot numbers, and expiry dates (FIFO)</p>
        </div>
        <button style={S.btn} onClick={() => { setShowModal(true); setForm(emptyForm); setError(""); }}>
          <Plus size={15} /> Add Batch
        </button>
      </div>

      {/* Alert banner for expiring items */}
      {expiringCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f59e0b15", border: "1px solid #f59e0b40", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          <AlertTriangle size={16} color="#f59e0b" />
          <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>
            {expiringCount} batch{expiringCount > 1 ? "es" : ""} expiring within 30 days
          </span>
          <button onClick={() => setTab("expiring")} style={{ marginLeft: "auto", fontSize: 12, color: "#f59e0b", background: "none", border: "1px solid #f59e0b50", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
            View All
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-hover)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {([["all", "All Batches"], ["expiring", "Expiring Soon"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: tab === key ? "var(--bg-card)" : "transparent", color: tab === key ? "var(--text-primary)" : "var(--text-ghost)", boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.25)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>Loading…</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-ghost)" }}>
            <Package size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0 }}>{tab === "expiring" ? "No batches expiring within 30 days" : "No batches yet. Add your first batch."}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Product", "Batch #", "Lot #", "Mfg Date", "Expiry Date", "Qty", "Cost Price", "Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {batches.map(b => {
                  const color = expiryColor(b.expiryDate);
                  const days = b.expiryDate ? daysUntil(b.expiryDate) : null;
                  return (
                    <tr key={b.id}>
                      <td style={S.td}>
                        <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>{b.product.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-ghost)" }}>{b.product.sku}</p>
                      </td>
                      <td style={S.td}><span style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg-hover)", padding: "2px 6px", borderRadius: 4 }}>{b.batchNumber}</span></td>
                      <td style={{ ...S.td, color: "var(--text-ghost)" }}>{b.lotNumber || "—"}</td>
                      <td style={S.td}>{b.manufacturingDate ? fmtDate(b.manufacturingDate) : "—"}</td>
                      <td style={S.td}>
                        {b.expiryDate ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CalendarDays size={13} color={color} />
                            <span style={{ color, fontWeight: 600 }}>{fmtDate(b.expiryDate)}</span>
                            {days !== null && (
                              <span style={{ fontSize: 11, color, background: color + "20", padding: "1px 6px", borderRadius: 4 }}>
                                {days < 0 ? "Expired" : days === 0 ? "Today" : `${days}d`}
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td style={S.td}>{b.quantity} {b.product.unit}</td>
                      <td style={S.td}>{b.costPrice ? `₹${b.costPrice.toLocaleString("en-IN")}` : "—"}</td>
                      <td style={S.td}>
                        <button onClick={() => deleteBatch(b.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: "4px 8px", borderRadius: 6 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Batch Modal */}
      {showModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Add Batch</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X size={18} /></button>
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={S.label}>Product *</label>
                <select value={form.productId} onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}
                  style={{ ...S.input, colorScheme: "dark" }}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="grid-r2" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Batch Number *</label>
                  <input value={form.batchNumber} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))} style={S.input} placeholder="e.g. BT-2024-001" />
                </div>
                <div>
                  <label style={S.label}>Lot Number</label>
                  <input value={form.lotNumber} onChange={e => setForm(p => ({ ...p, lotNumber: e.target.value }))} style={S.input} placeholder="Optional" />
                </div>
              </div>
              <div className="grid-r2" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Manufacturing Date</label>
                  <input type="date" value={form.manufacturingDate} onChange={e => setForm(p => ({ ...p, manufacturingDate: e.target.value }))} style={{ ...S.input, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={S.label}>Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} style={{ ...S.input, colorScheme: "dark" }} />
                </div>
              </div>
              <div className="grid-r2" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Quantity *</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} style={S.input} placeholder="0" />
                </div>
                <div>
                  <label style={S.label}>Cost Price</label>
                  <input type="number" value={form.costPrice} onChange={e => setForm(p => ({ ...p, costPrice: e.target.value }))} style={S.input} placeholder="₹0.00" />
                </div>
              </div>
              <div>
                <label style={S.label}>Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={S.input} placeholder="Optional notes" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-sec)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ ...S.btn, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Add Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
