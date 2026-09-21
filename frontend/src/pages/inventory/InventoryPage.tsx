import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Package, Plus, Search, AlertTriangle, TrendingDown, Tag, RefreshCw, X, Upload, Camera } from "lucide-react";
import DocumentsPanel from "@/components/DocumentsPanel";
import { kDigits, kDecimal, kAlphaNum, kName } from "@/lib/fieldRules";
import BulkImportModal from "@/components/ui/BulkImportModal";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useTranslation } from 'react-i18next';

const S = {
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  kpiValue: { fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 } as React.CSSProperties,
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 36px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  badge: (c: string) => ({ display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: c + "20", color: c }),
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
};

interface Summary { totalProducts: number; lowStock: number; outOfStock: number; inventoryValue: number; }
interface Product { id: string; sku: string; name: string; unit: string; costPrice: number; sellingPrice: number; taxRate: number; currentStock: number; reorderLevel: number; status: string; category?: { id: string; name: string } | null; categoryId?: string; hsnCode?: string; }
interface Category { id: string; name: string; }

const emptyForm = { sku: "", name: "", description: "", unit: "PCS", categoryId: "", costPrice: "", sellingPrice: "", mrp: "", taxRate: "0", hsnCode: "", reorderLevel: "0", barcode: "", notes: "" };

export default function InventoryPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMovement, setShowMovement] = useState(false);
  const [mvForm, setMvForm] = useState({ productId: "", type: "ADJUSTMENT_IN", quantity: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [sumRes, prodRes, catRes] = await Promise.all([
        api.get("/inventory/summary"),
        api.get(`/inventory?search=${search}&limit=100`),
        api.get("/inventory/categories"),
      ]);
      setSummary(sumRes.data.data);
      setProducts(prodRes.data.data.products);
      setCategories(catRes.data.data);
    } catch (e: any) {
      setLoadError(e?.response?.data?.message || "Failed to load inventory.");
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const saveProduct = async () => {
    setSaving(true); setError("");
    try {
      const payload = {
        ...form,
        costPrice: parseFloat(form.costPrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        mrp: form.mrp ? parseFloat(form.mrp) : undefined,
        taxRate: parseFloat(form.taxRate) || 0,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        categoryId: form.categoryId || undefined,
      };
      if (editId) await api.patch(`/inventory/${editId}`, payload);
      else await api.post("/inventory", payload);
      setShowModal(false); setForm(emptyForm); setEditId(null); load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to save");
    }
    setSaving(false);
  };

  const saveMovement = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/inventory/movements", { ...mvForm, quantity: parseFloat(mvForm.quantity) });
      setShowMovement(false); setMvForm({ productId: "", type: "ADJUSTMENT_IN", quantity: "", notes: "" }); load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed");
    }
    setSaving(false);
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ sku: p.sku, name: p.name, description: "", unit: p.unit, categoryId: p.categoryId || p.category?.id || "", costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice), mrp: "", taxRate: String(p.taxRate), hsnCode: p.hsnCode || "", reorderLevel: String(p.reorderLevel), barcode: "", notes: "" });
    setShowModal(true);
  };

  const stockColor = (p: Product) => {
    if (p.currentStock <= 0) return "#ef4444";
    if (p.currentStock <= p.reorderLevel) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_inventory') }</h1>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2 }}>Manage products, categories, and stock levels</p>
        </div>
        <div className="hdr-actions">
          <button style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }} onClick={() => setShowScanner(true)}>
            <Camera size={14} /> Scan Barcode
          </button>
          <button style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }} onClick={() => setShowImport(true)}>
            <Upload size={14} /> Import CSV
          </button>
          <button style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }} onClick={() => setShowMovement(true)}>
            <RefreshCw size={14} /> Adjust Stock
          </button>
          <button style={S.btn} onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true); }}>
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}>
          <span>{loadError}</span>
          <button onClick={() => setLoadError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700, marginLeft: 12 }}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        {[
          { label: "Total Products", value: summary?.totalProducts ?? "—", icon: <Package size={18} color="#6366f1" />, color: "#6366f1" },
          { label: "Low Stock", value: summary?.lowStock ?? "—", icon: <AlertTriangle size={18} color="#f59e0b" />, color: "#f59e0b" },
          { label: "Out of Stock", value: summary?.outOfStock ?? "—", icon: <TrendingDown size={18} color="#ef4444" />, color: "#ef4444" },
          { label: "Inventory Value", value: summary ? `₹${summary.inventoryValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—", icon: <Tag size={18} color="#10b981" />, color: "#10b981" },
        ].map((k) => (
          <div key={k.label} style={S.kpi}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={S.kpiLabel}>{k.label}</span>
              <div style={{ padding: 6, borderRadius: 8, background: k.color + "20" }}>{k.icon}</div>
            </div>
            <div style={S.kpiValue}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Products Table */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
            <input style={S.searchInput} placeholder="Search products, SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["SKU", "Product Name", "Category", "Unit", "Cost", "MRP/Sell", "Tax", "Stock", "Status"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No products yet. Add your first product.</td></tr>
                ) : products.map((p) => (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => openEdit(p)}>
                    <td style={S.td}><span style={{ fontFamily: "monospace", color: "#818CF8" }}>{p.sku}</span></td>
                    <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 500 }}>{p.name}</td>
                    <td style={S.td}>{p.category?.name || "—"}</td>
                    <td style={S.td}>{p.unit}</td>
                    <td style={S.td}>₹{p.costPrice.toLocaleString("en-IN")}</td>
                    <td style={S.td}>₹{p.sellingPrice.toLocaleString("en-IN")}</td>
                    <td style={S.td}>{p.taxRate}%</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: stockColor(p) }} />
                        <span style={{ color: stockColor(p), fontWeight: 600 }}>{p.currentStock}</span>
                        <span style={{ color: "var(--text-ghost)", fontSize: 11 }}>{p.unit}</span>
                      </div>
                    </td>
                    <td style={S.td}><span style={S.badge(p.status === "ACTIVE" ? "#10b981" : "#ef4444")}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>{editId ? "Edit Product" : "Add Product"}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>SKU *</label><input style={S.input} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. SKU-001" onKeyDown={kAlphaNum} maxLength={50} /></div>
                <div><label style={S.label}>Unit</label>
                  <select style={{ ...S.input, colorScheme: "dark" }} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {["PCS", "KG", "MTR", "LTR", "BOX", "PAIR", "SET", "DOZEN"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={S.label}>Product Name *</label><input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" onKeyDown={kName} maxLength={200} /></div>
              <div><label style={S.label}>Category</label>
                <select style={{ ...S.input, colorScheme: "dark" }} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">— Select Category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Cost Price (₹)</label><input type="number" style={S.input} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0" onKeyDown={kDecimal} /></div>
                <div><label style={S.label}>Selling Price (₹)</label><input type="number" style={S.input} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} placeholder="0" onKeyDown={kDecimal} /></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>MRP (₹)</label><input type="number" style={S.input} value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} placeholder="Optional" onKeyDown={kDecimal} /></div>
                <div><label style={S.label}>Tax Rate (%)</label>
                  <select style={{ ...S.input, colorScheme: "dark" }} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}>
                    {["0", "5", "12", "18", "28"].map(t => <option key={t} value={t}>{t}% GST</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>HSN Code</label><input style={S.input} value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} placeholder="e.g. 6201" onKeyDown={kDigits} maxLength={8} /></div>
                <div><label style={S.label}>Reorder Level</label><input type="number" style={S.input} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} placeholder="0" onKeyDown={kDecimal} /></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Barcode</label><input style={S.input} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Optional" onKeyDown={kAlphaNum} maxLength={50} /></div>
              </div>
            </div>
            {/* Attachments — only when editing an existing product */}
            {editId && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <DocumentsPanel entityType="PRODUCT" entityId={editId} compact />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveProduct} style={S.btn} disabled={saving}>{saving ? "Saving..." : editId ? "Update" : "Add Product"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {showMovement && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowMovement(false)}>
          <div className="modal-inner" style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>Adjust Stock</h3>
              <button onClick={() => setShowMovement(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Product</label>
                <select style={{ ...S.input, colorScheme: "dark" }} value={mvForm.productId} onChange={(e) => setMvForm({ ...mvForm, productId: e.target.value })}>
                  <option value="">— Select Product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stock: {p.currentStock}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Type</label>
                <select style={{ ...S.input, colorScheme: "dark" }} value={mvForm.type} onChange={(e) => setMvForm({ ...mvForm, type: e.target.value })}>
                  <option value="ADJUSTMENT_IN">Stock In (Adjustment)</option>
                  <option value="ADJUSTMENT_OUT">Stock Out (Adjustment)</option>
                  <option value="OPENING_STOCK">Opening Stock</option>
                </select>
              </div>
              <div><label style={S.label}>Quantity</label><input type="number" style={S.input} value={mvForm.quantity} onChange={(e) => setMvForm({ ...mvForm, quantity: e.target.value })} placeholder="0" onKeyDown={kDecimal} /></div>
              <div><label style={S.label}>Notes</label><input style={S.input} value={mvForm.notes} onChange={(e) => setMvForm({ ...mvForm, notes: e.target.value })} placeholder="Reason for adjustment" /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowMovement(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveMovement} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Adjust Stock"}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <BulkImportModal
          title="Import Products"
          endpoint="/inventory/bulk-import"
          onClose={() => setShowImport(false)}
          onSuccess={() => load()}
          columns={[
            { key: "Name", label: "Name", required: true },
            { key: "SKU", label: "SKU" },
            { key: "Unit", label: "Unit" },
            { key: "Cost Price", label: "Cost Price" },
            { key: "Selling Price", label: "Selling Price" },
            { key: "Tax Rate", label: "Tax Rate" },
            { key: "Reorder Level", label: "Reorder Level" },
            { key: "HSN Code", label: "HSN Code" },
          ]}
          sampleRows={[
            { Name: "Cotton T-Shirt", SKU: "TSH-001", Unit: "PCS", "Cost Price": "250", "Selling Price": "499", "Tax Rate": "5", "Reorder Level": "10", "HSN Code": "6109" },
            { Name: "Laptop Bag", SKU: "BAG-002", Unit: "PCS", "Cost Price": "800", "Selling Price": "1499", "Tax Rate": "18", "Reorder Level": "5", "HSN Code": "4202" },
          ]}
        />
      )}

      {showScanner && (
        <BarcodeScanner
          title="Scan Product Barcode / SKU"
          onClose={() => setShowScanner(false)}
          onScan={code => { setSearch(code); setShowScanner(false); }}
        />
      )}
    </div>
  );
}
