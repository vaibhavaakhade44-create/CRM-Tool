import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Warehouse, Plus, Search, X, ArrowRightLeft } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { kAlpha } from "@/lib/fieldRules";

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 480, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16 } as React.CSSProperties,
  searchWrap: { position: "relative" as const, flex: 1, maxWidth: 300 },
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  searchIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
};

const ST_COLORS: Record<string, string> = { DRAFT: "#818cf8", IN_TRANSIT: "#f59e0b", COMPLETED: "#10b981", CANCELLED: "#ef4444" };

interface WH { id: string; name: string; code: string; city?: string; state?: string; isDefault: boolean; _count?: { products: number } }
interface Transfer { id: string; transferNumber: string; status: string; createdAt: string; fromWarehouse?: { name: string } | null; toWarehouse?: { name: string } | null; _count?: { items: number } }
interface Product { id: string; name: string; sku: string; }

export default function WarehousePage() {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<WH[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"warehouses" | "transfers">("warehouses");
  const [showWhModal, setShowWhModal] = useState(false);
  const [showTrModal, setShowTrModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [whForm, setWhForm] = useState({ name: "", code: "", address: "", city: "", state: "", pincode: "", isDefault: false });
  const [trForm, setTrForm] = useState({ fromWarehouseId: "", toWarehouseId: "", notes: "", items: [{ productId: "", quantity: "" }] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, tRes, pRes] = await Promise.all([
        api.get("/warehouses"),
        api.get(`/warehouses/transfers?search=${search}&limit=100`),
        api.get("/inventory?limit=200"),
      ]);
      setWarehouses(wRes.data.data || []);
      setTransfers(tRes.data.data || []);
      setProducts(pRes.data.data?.products || pRes.data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const saveWarehouse = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/warehouses", whForm);
      setShowWhModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const saveTransfer = async () => {
    setSaving(true); setError("");
    try {
      const payload = { ...trForm, items: trForm.items.filter(i => i.productId && i.quantity).map(i => ({ productId: i.productId, quantity: parseFloat(i.quantity) })) };
      await api.post("/warehouses/transfers", payload);
      setShowTrModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const completeTransfer = async (id: string) => {
    try { await api.patch(`/warehouses/transfers/${id}/complete`); load(); } catch { /* ignore */ }
  };

  const addItem = () => setTrForm(p => ({ ...p, items: [...p.items, { productId: "", quantity: "" }] }));
  const removeItem = (i: number) => setTrForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, k: "productId" | "quantity", v: string) => setTrForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>{ t('page_warehouse') }</h1>
          <p style={S.subtitle}>Multi-location inventory, stock transfers and audits</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }} onClick={() => { setError(""); setShowTrModal(true); }}>
            <ArrowRightLeft size={14} /> New Transfer
          </button>
          <button style={S.btn} onClick={() => { setError(""); setShowWhModal(true); }}>
            <Plus size={15} /> Add Warehouse
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["warehouses", "transfers"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: tab === t ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-card)", color: tab === t ? "white" : "var(--text-ghost)", cursor: "pointer", fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
        <>
          {tab === "warehouses" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {warehouses.length === 0 ? (
                <div style={{ ...S.card, textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No warehouses yet. Add your first warehouse.</div>
              ) : warehouses.map(w => (
                <div key={w.id} style={{ ...S.card, borderColor: w.isDefault ? "#6366f1" : "var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{w.name}</div>
                      <div style={{ fontSize: 12, color: "#818cf8", fontFamily: "monospace" }}>{w.code}</div>
                    </div>
                    {w.isDefault && <span style={{ fontSize: 10, background: "#6366f120", color: "#818cf8", padding: "2px 7px", borderRadius: 5, fontWeight: 600 }}>DEFAULT</span>}
                  </div>
                  {(w.city || w.state) && <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>{[w.city, w.state].filter(Boolean).join(", ")}</div>}
                  <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg-hover)", borderRadius: 8, fontSize: 12, color: "var(--text-sec)" }}>
                    <Warehouse size={12} style={{ display: "inline", marginRight: 6, color: "var(--text-ghost)" }} />
                    {w._count?.products || 0} products
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "transfers" && (
            <div style={S.card}>
              <div style={S.toolbar}>
                <div style={S.searchWrap}>
                  <Search size={14} style={S.searchIcon} />
                  <input style={S.searchInput} placeholder="Search transfers..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Transfer#", "From", "To", "Items", "Status", "Date", "Action"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No transfers yet.</td></tr>
                  ) : transfers.map(t => (
                    <tr key={t.id}>
                      <td style={{ ...S.td, color: "#818CF8", fontWeight: 600, fontFamily: "monospace" }}>{t.transferNumber}</td>
                      <td style={S.td}>{t.fromWarehouse?.name || "—"}</td>
                      <td style={S.td}>{t.toWarehouse?.name || "—"}</td>
                      <td style={S.td}>{t._count?.items || 0}</td>
                      <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (ST_COLORS[t.status] || "#818cf8") + "20", color: ST_COLORS[t.status] || "#818cf8" }}>{t.status}</span></td>
                      <td style={S.td}>{new Date(t.createdAt).toLocaleDateString("en-IN")}</td>
                      <td style={S.td}>
                        {t.status === "DRAFT" && <button onClick={() => completeTransfer(t.id)} style={{ background: "#10b98120", color: "#10b981", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>Complete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Warehouse Modal */}
      {showWhModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowWhModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>Add Warehouse</h3>
              <button onClick={() => setShowWhModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>Name *</label><input style={S.input} value={whForm.name} onChange={e => setWhForm(p => ({ ...p, name: e.target.value }))} placeholder="Main Warehouse" /></div>
                <div><label style={S.label}>Code *</label><input style={S.input} value={whForm.code} onChange={e => setWhForm(p => ({ ...p, code: e.target.value }))} placeholder="WH-001" /></div>
              </div>
              <div><label style={S.label}>Address</label><input style={S.input} value={whForm.address} onChange={e => setWhForm(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="grid-r2">
                <div><label style={S.label}>City</label><input style={S.input} value={whForm.city} onChange={e => setWhForm(p => ({ ...p, city: e.target.value }))} onKeyDown={kAlpha} maxLength={100} /></div>
                <div><label style={S.label}>State</label><input style={S.input} value={whForm.state} onChange={e => setWhForm(p => ({ ...p, state: e.target.value }))} onKeyDown={kAlpha} maxLength={100} /></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="isDefault" checked={whForm.isDefault} onChange={e => setWhForm(p => ({ ...p, isDefault: e.target.checked }))} />
                <label htmlFor="isDefault" style={{ color: "var(--text-sec)", fontSize: 13, cursor: "pointer" }}>Set as default warehouse</label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowWhModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveWarehouse} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Add Warehouse"}</button>
            </div>
          </div>
        </div>
      )}

      {/* New Transfer Modal */}
      {showTrModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowTrModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 540 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Stock Transfer</h3>
              <button onClick={() => setShowTrModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>From Warehouse *</label>
                  <select style={S.select} value={trForm.fromWarehouseId} onChange={e => setTrForm(p => ({ ...p, fromWarehouseId: e.target.value }))}>
                    <option value="">— Select —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>To Warehouse *</label>
                  <select style={S.select} value={trForm.toWarehouseId} onChange={e => setTrForm(p => ({ ...p, toWarehouseId: e.target.value }))}>
                    <option value="">— Select —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={S.label}>Items</label>
                  <button onClick={addItem} style={{ background: "#6366f120", color: "#818cf8", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>+ Add Item</button>
                </div>
                {trForm.items.map((item, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 32px", gap: 8, marginBottom: 8 }}>
                    <select style={S.select} value={item.productId} onChange={e => updateItem(i, "productId", e.target.value)}>
                      <option value="">— Product —</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                    <input type="number" style={S.input} placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} />
                    {trForm.items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: "#ef444420", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer" }}><X size={14} /></button>}
                  </div>
                ))}
              </div>
              <div><label style={S.label}>Notes</label><textarea style={{ ...S.input, minHeight: 60, resize: "vertical" as const }} value={trForm.notes} onChange={e => setTrForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowTrModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveTransfer} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Create Transfer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
