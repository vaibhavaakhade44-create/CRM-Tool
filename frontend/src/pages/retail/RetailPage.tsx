import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Shirt, Plus, ShoppingCart, X, Package } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  tabs: { display: "flex", gap: 4, marginBottom: 24 } as React.CSSProperties,
  tab: (a: boolean) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: a ? "rgba(99,102,241,0.15)" : "transparent", color: a ? "#818CF8" : "var(--text-ghost)" }) as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 500, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 } as React.CSSProperties,
  posGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 } as React.CSSProperties,
};

interface Collection { id: string; name: string; season?: string; year?: number; _count?: { variants: number }; }
interface Variant { id: string; sku: string; size?: string; color?: string; sellingPrice: number; stock: number; product?: { name: string; id: string }; collection?: { name: string } | null; }
interface Product { id: string; name: string; sku: string; }
interface POSSession { id: string; status: string; openedAt: string; totalSales: number; }

export default function RetailPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"collections" | "variants" | "pos">("collections");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sessions, setSessions] = useState<POSSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColModal, setShowColModal] = useState(false);
  const [showVarModal, setShowVarModal] = useState(false);
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [colForm, setColForm] = useState({ name: "", season: "", year: "" });
  const [varForm, setVarForm] = useState({ productId: "", collectionId: "", sku: "", size: "", color: "", material: "", costPrice: "", sellingPrice: "", mrp: "", stock: "0" });
  const [posItems, setPosItems] = useState<Array<{ variantId: string; name: string; quantity: number; unitPrice: number }>>([]);
  const [openSession, setOpenSession] = useState<POSSession | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, vRes, pRes, sRes] = await Promise.all([
        api.get("/retail/collections"),
        api.get("/retail/variants?limit=200"),
        api.get("/inventory?limit=500"),
        api.get("/retail/pos/sessions"),
      ]);
      setCollections(cRes.data.data);
      setVariants(vRes.data.data);
      setProducts(pRes.data.data.products);
      const allSessions: POSSession[] = sRes.data.data;
      setSessions(allSessions);
      setOpenSession(allSessions.find(s => s.status === "OPEN") || null);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveCollection = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/retail/collections", { ...colForm, year: colForm.year ? parseInt(colForm.year) : undefined, season: colForm.season || undefined });
      setShowColModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const saveVariant = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/retail/variants", {
        productId: varForm.productId,
        collectionId: varForm.collectionId || undefined,
        sku: varForm.sku,
        size: varForm.size || undefined,
        color: varForm.color || undefined,
        material: varForm.material || undefined,
        costPrice: parseFloat(varForm.costPrice) || 0,
        sellingPrice: parseFloat(varForm.sellingPrice) || 0,
        mrp: varForm.mrp ? parseFloat(varForm.mrp) : undefined,
        stock: parseFloat(varForm.stock) || 0,
      });
      setShowVarModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const openPOSSession = async () => {
    try { await api.post("/retail/pos/sessions", { openingCash: 0 }); load(); } catch { /* ignore */ }
  };

  const completeSale = async () => {
    if (!openSession || posItems.length === 0) return;
    setSaving(true);
    try {
      const total = posItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      await api.post("/retail/pos/sales", {
        sessionId: openSession.id,
        paymentMethod: "CASH",
        paidAmount: total,
        items: posItems.map(i => ({ variantId: i.variantId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: 0, discount: 0 })),
      });
      setPosItems([]); load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const addToCart = (v: Variant) => {
    setPosItems(prev => {
      const existing = prev.find(i => i.variantId === v.id);
      if (existing) return prev.map(i => i.variantId === v.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { variantId: v.id, name: `${v.product?.name || ""} ${v.size ? `(${v.size}` : ""} ${v.color ? `/ ${v.color})` : ""}`.trim(), quantity: 1, unitPrice: v.sellingPrice }];
    });
  };

  const cartTotal = posItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>{ t('page_retail') }</h1>
          <p style={S.subtitle}>Collections, size/color variants, and boutique POS</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!openSession ? (
            <button style={{ ...S.btn, background: "#10b98120", color: "#10b981", border: "1px solid #10b98140" }} onClick={openPOSSession}><ShoppingCart size={14} /> Open POS</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "#10b98115", border: "1px solid #10b98140" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600 }}>POS Active</span>
            </div>
          )}
          <button style={S.btn} onClick={() => tab === "collections" ? (setColForm({ name: "", season: "", year: "" }), setError(""), setShowColModal(true)) : (setVarForm({ productId: "", collectionId: "", sku: "", size: "", color: "", material: "", costPrice: "", sellingPrice: "", mrp: "", stock: "0" }), setError(""), setShowVarModal(true))}>
            <Plus size={15} /> {tab === "collections" ? "New Collection" : tab === "variants" ? "Add Variant" : ""}
          </button>
        </div>
      </div>

      <div style={S.tabs}>
        <button style={S.tab(tab === "collections")} onClick={() => setTab("collections")}><Package size={14} style={{ display: "inline", marginRight: 6 }} />Collections ({collections.length})</button>
        <button style={S.tab(tab === "variants")} onClick={() => setTab("variants")}><Shirt size={14} style={{ display: "inline", marginRight: 6 }} />Variants ({variants.length})</button>
        <button style={S.tab(tab === "pos")} onClick={() => setTab("pos")}><ShoppingCart size={14} style={{ display: "inline", marginRight: 6 }} />POS</button>
      </div>

      {tab === "collections" && (
        <div style={S.card}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Collection", "Season", "Year", "Variants"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {collections.length === 0 ? <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No collections yet.</td></tr> : collections.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 500 }}>{c.name}</td>
                    <td style={S.td}>{c.season || "—"}</td>
                    <td style={S.td}>{c.year || "—"}</td>
                    <td style={S.td}>{c._count?.variants || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {tab === "variants" && (
        <div style={S.card}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["SKU", "Product", "Size", "Color", "Collection", "Price", "Stock"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {variants.length === 0 ? <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No variants yet.</td></tr> : variants.map(v => (
                  <tr key={v.id} onClick={() => openSession && addToCart(v)} style={{ cursor: openSession ? "pointer" : "default" }}>
                    <td style={{ ...S.td, fontFamily: "monospace", color: "#818CF8" }}>{v.sku}</td>
                    <td style={{ ...S.td, color: "var(--text-primary)" }}>{v.product?.name || "—"}</td>
                    <td style={S.td}>{v.size ? <span style={{ padding: "2px 8px", borderRadius: 5, background: "#6366f120", color: "#818CF8", fontSize: 12, fontWeight: 600 }}>{v.size}</span> : "—"}</td>
                    <td style={S.td}>
                      {v.color ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, background: v.color.toLowerCase(), border: "1px solid #2a2a4a" }} />
                          <span>{v.color}</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td style={S.td}>{v.collection?.name || "—"}</td>
                    <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 600 }}>₹{v.sellingPrice.toLocaleString("en-IN")}</td>
                    <td style={{ ...S.td, color: v.stock > 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>{v.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {openSession && <div style={{ marginTop: 12, padding: "8px 12px", background: "#818CF820", borderRadius: 8, fontSize: 12, color: "#818CF8" }}>💡 Click a variant to add to cart</div>}
        </div>
      )}

      {tab === "pos" && (
        <div style={S.posGrid}>
          <div style={S.card}>
            <h3 style={{ color: "var(--text-primary)", margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Cart</h3>
            {posItems.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)" }}>Cart is empty. Click variants to add items.</div>
            ) : (
              <>
                {posItems.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bg-hover)" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)" }}>{item.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#818CF8" }}>₹{item.unitPrice.toLocaleString("en-IN")} × {item.quantity}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => setPosItems(prev => prev.map((it, j) => j === i ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-sec)", borderRadius: 5, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                      <span style={{ color: "var(--text-primary)", minWidth: 24, textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => setPosItems(prev => prev.map((it, j) => j === i ? { ...it, quantity: it.quantity + 1 } : it))} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-sec)", borderRadius: 5, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600, minWidth: 70, textAlign: "right" }}>₹{(item.quantity * item.unitPrice).toLocaleString("en-IN")}</span>
                    <button onClick={() => setPosItems(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={14} /></button>
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ color: "var(--text-ghost)", fontSize: 13 }}>Total</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 20 }}>₹{cartTotal.toLocaleString("en-IN")}</span>
                  </div>
                  <button onClick={completeSale} disabled={!openSession || saving} style={{ ...S.btn, width: "100%", justifyContent: "center", opacity: !openSession ? 0.5 : 1 }}>
                    {saving ? "Processing..." : "Complete Sale"}
                  </button>
                  {!openSession && <p style={{ fontSize: 12, color: "#ef4444", textAlign: "center", marginTop: 8 }}>Open a POS session first</p>}
                </div>
              </>
            )}
          </div>

          <div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <h3 style={{ color: "var(--text-primary)", margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>POS Sessions</h3>
              {sessions.slice(0, 5).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bg-hover)", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.status === "OPEN" ? "#10b981" : "var(--text-ghost)" }} />
                      <span style={{ fontSize: 12, color: "var(--text-sec)" }}>{new Date(s.openedAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>
                  <span style={{ color: "#10b981", fontSize: 13, fontWeight: 600 }}>₹{s.totalSales.toLocaleString("en-IN")}</span>
                </div>
              ))}
              {!openSession && <button onClick={openPOSSession} style={{ ...S.btn, width: "100%", justifyContent: "center", marginTop: 12, background: "#10b98120", color: "#10b981", border: "1px solid #10b98140" }}>Open New Session</button>}
              {openSession && <button onClick={async () => { try { await api.patch(`/retail/pos/sessions/${openSession.id}/close`, { closingCash: openSession.totalSales }); load(); } catch { /* ignore */ } }} style={{ ...S.btn, width: "100%", justifyContent: "center", marginTop: 12, background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440" }}>Close Session</button>}
            </div>
          </div>
        </div>
      )}

      {showColModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowColModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Collection</h3>
              <button onClick={() => setShowColModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Collection Name *</label><input style={S.input} value={colForm.name} onChange={(e) => setColForm({ ...colForm, name: e.target.value })} placeholder="e.g. Summer 2025" /></div>
              <div className="grid-r2">
                <div><label style={S.label}>Season</label>
                  <select style={S.select} value={colForm.season} onChange={(e) => setColForm({ ...colForm, season: e.target.value })}>
                    <option value="">— Optional —</option>
                    {["Spring/Summer","Autumn/Winter","Pre-Fall","Resort","All Season"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Year</label><input type="number" style={S.input} value={colForm.year} onChange={(e) => setColForm({ ...colForm, year: e.target.value })} placeholder="2025" /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowColModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveCollection} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {showVarModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowVarModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>Add Product Variant</h3>
              <button onClick={() => setShowVarModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Product *</label>
                <select style={S.select} value={varForm.productId} onChange={(e) => setVarForm({ ...varForm, productId: e.target.value })}>
                  <option value="">— Select Product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div><label style={S.label}>Collection</label>
                <select style={S.select} value={varForm.collectionId} onChange={(e) => setVarForm({ ...varForm, collectionId: e.target.value })}>
                  <option value="">— Optional —</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Variant SKU *</label><input style={S.input} value={varForm.sku} onChange={(e) => setVarForm({ ...varForm, sku: e.target.value })} placeholder="e.g. SHIRT-RED-L" /></div>
                <div><label style={S.label}>Size</label>
                  <select style={S.select} value={varForm.size} onChange={(e) => setVarForm({ ...varForm, size: e.target.value })}>
                    <option value="">— None —</option>
                    {["XS","S","M","L","XL","XXL","XXXL","Free Size","28","30","32","34","36","38","40"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Color</label><input style={S.input} value={varForm.color} onChange={(e) => setVarForm({ ...varForm, color: e.target.value })} placeholder="e.g. Red, Navy Blue" /></div>
                <div><label style={S.label}>Material</label><input style={S.input} value={varForm.material} onChange={(e) => setVarForm({ ...varForm, material: e.target.value })} placeholder="e.g. Cotton, Silk" /></div>
              </div>
              <div className="grid-r3">
                <div><label style={S.label}>Cost ₹</label><input type="number" style={S.input} value={varForm.costPrice} onChange={(e) => setVarForm({ ...varForm, costPrice: e.target.value })} /></div>
                <div><label style={S.label}>Sell ₹</label><input type="number" style={S.input} value={varForm.sellingPrice} onChange={(e) => setVarForm({ ...varForm, sellingPrice: e.target.value })} /></div>
                <div><label style={S.label}>MRP ₹</label><input type="number" style={S.input} value={varForm.mrp} onChange={(e) => setVarForm({ ...varForm, mrp: e.target.value })} /></div>
              </div>
              <div><label style={S.label}>Opening Stock</label><input type="number" style={S.input} value={varForm.stock} onChange={(e) => setVarForm({ ...varForm, stock: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowVarModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveVariant} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Add Variant"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
