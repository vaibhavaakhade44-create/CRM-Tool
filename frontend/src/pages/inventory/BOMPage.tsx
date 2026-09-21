import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Layers, Plus, Trash2, RefreshCw, PlayCircle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, X } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface Product { id: string; name: string; sku: string; unit?: string; currentStock?: number; }
interface BOMItem { id: string; component: Product; quantity: number; unit: string; }
interface BOM { id: string; name: string; version: string; product: Product; items: BOMItem[]; _count: { workOrders: number }; }
interface WorkOrder { id: string; workOrderNo: string; status: string; quantity: number; startDate?: string; endDate?: string; completedAt?: string; bom: BOM & { product: Product }; }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT:       { bg: "#6366f122", color: "#818cf8" },
  IN_PROGRESS: { bg: "#f59e0b22", color: "#f59e0b" },
  COMPLETED:   { bg: "#10b98122", color: "#10b981" },
  CANCELLED:   { bg: "#ef444422", color: "#ef4444" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT;
  return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, fontWeight: 700 }}>{status.replace("_", " ")}</span>;
}

function AddBOMModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [items, setItems] = useState([{ componentId: "", quantity: "1", unit: "PCS" }]);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg?.id ?? "" };

  useEffect(() => {
    fetch(`${API}/inventory?limit=200`, { headers })
      .then(r => r.json()).then(d => setProducts(d.data?.products ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setItem(i: number, k: string, v: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  }

  async function submit() {
    if (!productId || !name || !items[0].componentId) return;
    setSaving(true);
    try {
      await fetch(`${API}/bom`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          productId, name, version,
          items: items.filter(it => it.componentId).map(it => ({ componentId: it.componentId, quantity: Number(it.quantity) || 1, unit: it.unit })),
        }),
      });
      onCreated(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>New Bill of Materials</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Finished Product</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>BOM Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Assembly"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Components</label>
              <button onClick={() => setItems(prev => [...prev, { componentId: "", quantity: "1", unit: "PCS" }])}
                style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer" }}>+ Add</button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <select value={it.componentId} onChange={e => setItem(i, "componentId", e.target.value)}
                  style={{ flex: 3, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }}>
                  <option value="">Select component…</option>
                  {products.filter(p => p.id !== productId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} placeholder="Qty"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }} />
                <input value={it.unit} onChange={e => setItem(i, "unit", e.target.value)} placeholder="Unit"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }} />
                {items.length > 1 && (
                  <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !productId || !name}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#6366f1", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: productId && name ? 1 : 0.5 }}>
            {saving ? "Creating…" : "Create BOM"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateWOModal({ bom, onClose, onCreated }: { bom: BOM; onClose: () => void; onCreated: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [qty, setQty] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await fetch(`${API}/bom/work-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": activeOrg?.id ?? "" },
        body: JSON.stringify({ bomId: bom.id, quantity: Number(qty), startDate: startDate || undefined, endDate: endDate || undefined }),
      });
      onCreated(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 400, border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>New Work Order — {bom.product.name}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Quantity to Produce</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1"
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
          </div>
          <div className="grid-r2" style={{ gap: 10 }}>
            {[{ label: "Start Date", k: startDate, set: setStartDate }, { label: "End Date", k: endDate, set: setEndDate }].map(({ label, k, set }) => (
              <div key={label}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>{label}</label>
                <input type="date" value={k} onChange={e => set(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#6366f1", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Creating…" : "Create Work Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BOMPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [tab, setTab] = useState<"boms" | "workorders">("boms");
  const [boms, setBoms] = useState<BOM[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [woFor, setWoFor] = useState<BOM | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [woFilter, setWoFilter] = useState("ALL");

  const headers = { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg?.id ?? "" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [br, wr] = await Promise.all([
        fetch(`${API}/bom`, { headers }).then(r => r.json()),
        fetch(`${API}/bom/work-orders`, { headers }).then(r => r.json()),
      ]);
      setBoms(br.data?.boms ?? []);
      setWorkOrders(wr.data?.workOrders ?? []);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeOrg?.id]);

  useEffect(() => { load(); }, [load]);

  async function updateWOStatus(id: string, status: string) {
    await fetch(`${API}/bom/work-orders/${id}/status`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function deleteBOM(id: string) {
    if (!confirm("Delete this BOM?")) return;
    await fetch(`${API}/bom/${id}`, { method: "DELETE", headers });
    setBoms(prev => prev.filter(b => b.id !== id));
  }

  const filteredWOs = woFilter === "ALL" ? workOrders : workOrders.filter(w => w.status === woFilter);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Bill of Materials & Work Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-ghost)" }}>Define product recipes and manage production runs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} style={{ padding: "6px 10px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {tab === "boms" && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: "#6366f1", color: "#fff", border: "none", cursor: "pointer" }}>
              <Plus className="w-3.5 h-3.5" /> New BOM
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total BOMs", value: boms.length, color: "#6366f1" },
          { label: "Work Orders", value: workOrders.length, color: "#0ea5e9" },
          { label: "In Progress", value: workOrders.filter(w => w.status === "IN_PROGRESS").length, color: "#f59e0b" },
          { label: "Completed", value: workOrders.filter(w => w.status === "COMPLETED").length, color: "#10b981" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["boms", "workorders"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: tab === t ? "#6366f1" : "var(--bg-hover)", color: tab === t ? "#fff" : "var(--text-secondary)" }}>
            {t === "boms" ? `BOMs (${boms.length})` : `Work Orders (${workOrders.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-ghost)" }} /></div>
      ) : tab === "boms" ? (
        boms.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-ghost)", opacity: 0.3 }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No BOMs yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>Create a bill of materials to define what components go into a product</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {boms.map(bom => (
              <div key={bom.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpanded(expanded === bom.id ? null : bom.id)}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{bom.name}</span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#6366f122", color: "#818cf8", fontWeight: 700 }}>v{bom.version}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
                      {bom.product.name} ({bom.product.sku}) · {bom.items.length} components · {bom._count.workOrders} work orders
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); setWoFor(bom); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                      style={{ background: "#6366f122", color: "#818cf8", border: "none", cursor: "pointer" }}>
                      <PlayCircle className="w-3 h-3" /> Start WO
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteBOM(bom.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded === bom.id ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-ghost)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-ghost)" }} />}
                  </div>
                </div>
                {expanded === bom.id && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px" }}>
                    <div className="overflow-x-auto">
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Component", "SKU", "Qty", "Unit", "Stock"].map(h => (
                            <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bom.items.map(item => (
                          <tr key={item.id}>
                            <td style={{ padding: "5px 8px", fontSize: 12, color: "var(--text-primary)" }}>{item.component.name}</td>
                            <td style={{ padding: "5px 8px", fontSize: 11, color: "var(--text-ghost)" }}>{item.component.sku}</td>
                            <td style={{ padding: "5px 8px", fontSize: 12, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</td>
                            <td style={{ padding: "5px 8px", fontSize: 11, color: "var(--text-ghost)" }}>{item.unit}</td>
                            <td style={{ padding: "5px 8px", fontSize: 12, color: (item.component.currentStock ?? 0) < item.quantity ? "#ef4444" : "#10b981" }}>
                              {item.component.currentStock ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div>
          <div className="flex gap-2 mb-3 flex-wrap">
            {["ALL", "DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(s => (
              <button key={s} onClick={() => setWoFilter(s)}
                style={{ padding: "4px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: woFilter === s ? "#6366f1" : "var(--bg-hover)",
                  color: woFilter === s ? "#fff" : "var(--text-secondary)" }}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          {filteredWOs.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-ghost)", opacity: 0.3 }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No work orders found</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {filteredWOs.map(wo => (
                <div key={wo.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: "#818cf8" }}>{wo.workOrderNo}</span>
                      <StatusBadge status={wo.status} />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
                      {wo.bom.product.name} · Qty: {wo.quantity}
                      {wo.startDate && ` · From ${new Date(wo.startDate).toLocaleDateString("en-IN")}`}
                      {wo.endDate && ` to ${new Date(wo.endDate).toLocaleDateString("en-IN")}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {wo.status === "DRAFT" && (
                      <button onClick={() => updateWOStatus(wo.id, "IN_PROGRESS")} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: "#f59e0b22", color: "#f59e0b", border: "none", cursor: "pointer" }}>
                        <PlayCircle className="w-3 h-3" /> Start
                      </button>
                    )}
                    {wo.status === "IN_PROGRESS" && (
                      <button onClick={() => updateWOStatus(wo.id, "COMPLETED")} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: "#10b98122", color: "#10b981", border: "none", cursor: "pointer" }}>
                        <CheckCircle className="w-3 h-3" /> Complete
                      </button>
                    )}
                    {(wo.status === "DRAFT" || wo.status === "IN_PROGRESS") && (
                      <button onClick={() => updateWOStatus(wo.id, "CANCELLED")} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: "#ef444422", color: "#ef4444", border: "none", cursor: "pointer" }}>
                        <XCircle className="w-3 h-3" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && <AddBOMModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {woFor && <CreateWOModal bom={woFor} onClose={() => setWoFor(null)} onCreated={load} />}
    </div>
  );
}
