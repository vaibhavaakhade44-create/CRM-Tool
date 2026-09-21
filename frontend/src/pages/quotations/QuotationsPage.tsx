import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { FileText, Plus, Search, X, Eye, Trash2, CheckCircle, Send, Clock, XCircle, Printer } from "lucide-react";
import { kDecimal } from "@/lib/fieldRules";
import { useTranslation } from 'react-i18next';

const S = {
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  kpiValue: { fontSize: 26, fontWeight: 700, margin: "4px 0 0" } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const },
  td: { padding: "12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT:    { label: "Draft",    color: "#818cf8", bg: "rgba(99,102,241,0.12)",  icon: <Clock size={11} /> },
  SENT:     { label: "Sent",     color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  icon: <Send size={11} /> },
  ACCEPTED: { label: "Accepted", color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: <CheckCircle size={11} /> },
  REJECTED: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.12)",  icon: <XCircle size={11} /> },
  EXPIRED:  { label: "Expired",  color: "#6b7280", bg: "rgba(107,114,128,0.12)", icon: <Clock size={11} /> },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT:    ["SENT"],
  SENT:     ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: ["DRAFT"],
  EXPIRED:  ["DRAFT"],
};

interface QItem { id?: string; description: string; quantity: string; unitPrice: string; taxRate: string; discount: string; productId?: string; }
interface Product { id: string; name: string; sku: string; sellingPrice?: number; }
interface Party { id: string; name: string; email?: string; }
interface Quotation {
  id: string; quotationNumber: string; status: string; subject?: string;
  party?: { id: string; name: string; email?: string } | null;
  subtotal: number; taxAmount: number; discount: number; total: number;
  validUntil?: string; notes?: string; terms?: string;
  items?: QItem[]; createdAt: string;
}
interface Stats { total: number; accepted: number; sent: number; draft: number; acceptedValue: number; }

const emptyItem = (): QItem => ({
description: "", quantity: "1", unitPrice: "0", taxRate: "0", discount: "0", productId: "" });

function calcItem(i: QItem) {
  const qty = parseFloat(i.quantity) || 0;
  const price = parseFloat(i.unitPrice) || 0;
  const tax = parseFloat(i.taxRate) || 0;
  const disc = parseFloat(i.discount) || 0;
  const taxAmt = (qty * price - disc) * (tax / 100);
  return qty * price - disc + taxAmt;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function QuotationsPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewQt, setViewQt] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Create form state
  const [form, setForm] = useState({ partyId: "", subject: "", validUntil: "", notes: "", terms: "" });
  const [items, setItems] = useState<QItem[]>([emptyItem()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const [qRes, sRes] = await Promise.all([
        api.get("/quotations", { params }),
        api.get("/quotations/stats"),
      ]);
      setQuotations(qRes.data.data?.quotations || []);
      setStats(sRes.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get("/parties", { params: { limit: 500 } }).then(r => setParties(r.data.data?.parties || [])).catch(() => {});
    api.get("/inventory", { params: { limit: 500 } }).then(r => setProducts(r.data.data?.products || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setForm({ partyId: "", subject: "", validUntil: "", notes: "", terms: "" });
    setItems([emptyItem()]);
    setError("");
    setShowCreate(true);
  };

  const addItem = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof QItem, val: string) => {
    setItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === "productId" && val) {
        const prod = products.find(p => p.id === val);
        if (prod) {
          updated.description = prod.name;
          if (prod.sellingPrice) updated.unitPrice = String(prod.sellingPrice);
        }
      }
      return updated;
    }));
  };

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const totalDiscount = items.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
  const totalTax = items.reduce((s, i) => {
    const qty = parseFloat(i.quantity) || 0;
    const price = parseFloat(i.unitPrice) || 0;
    const tax = parseFloat(i.taxRate) || 0;
    const disc = parseFloat(i.discount) || 0;
    return s + (qty * price - disc) * (tax / 100);
  }, 0);
  const grandTotal = items.reduce((s, i) => s + calcItem(i), 0);

  const handleCreate = async () => {
    if (!form.subject && !form.partyId) { setError("Add a subject or select a party."); return; }
    if (items.every(i => !i.description)) { setError("Add at least one line item."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/quotations", { ...form, items: items.filter(i => i.description) });
      setShowCreate(false);
      load();
    } catch (e: any) { setError(e.response?.data?.message || "Failed to create"); }
    setSaving(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/quotations/${id}/status`, { status: newStatus });
      load();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this quotation?")) return;
    try { await api.delete(`/quotations/${id}`); load(); } catch { /* ignore */ }
  };

  const openView = async (id: string) => {
    try {
      const r = await api.get(`/quotations/${id}`);
      setViewQt(r.data.data);
    } catch { /* ignore */ }
  };

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const esc = (s: string | null | undefined) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const openQuotationPrint = (q: Quotation) => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const rows = (q.items || []).map((item, i) => {
      const qty   = parseFloat(String(item.quantity))  || 0;
      const price = parseFloat(String(item.unitPrice)) || 0;
      const tax   = parseFloat(String(item.taxRate))   || 0;
      const disc  = parseFloat(String(item.discount))  || 0;
      const total = qty * price - disc + (qty * price - disc) * (tax / 100);
      return `<tr>
        <td>${i + 1}</td><td>${esc(item.description)}</td><td>${qty}</td>
        <td>₹${fmt(price)}</td><td>${tax}%</td><td>₹${fmt(disc)}</td>
        <td><strong>₹${fmt(total)}</strong></td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Quotation ${esc(q.quotationNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
      h2 { margin: 0 0 4px; } .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background: #f4f4f4; padding: 8px 10px; text-align: left; font-size: 12px; border-bottom: 2px solid #ddd; }
      td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #eee; }
      .totals { float: right; width: 280px; }
      .totals tr td { border: none; padding: 5px 8px; }
      .totals tr:last-child td { font-weight: bold; font-size: 15px; border-top: 2px solid #111; }
      .notes { margin-top: 24px; font-size: 13px; color: #444; white-space: pre-wrap; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <h2>QUOTATION</h2>
    <div class="meta">
      <strong>${esc(q.quotationNumber)}</strong> &nbsp;·&nbsp; Status: ${esc(q.status)}
      ${q.party?.name ? `&nbsp;·&nbsp; Party: ${esc(q.party.name)}` : ""}
      ${q.subject ? `<br/>Subject: ${esc(q.subject)}` : ""}
      ${q.validUntil ? `<br/>Valid Until: ${new Date(q.validUntil).toLocaleDateString("en-IN")}` : ""}
    </div>
    <table><thead><tr>
      <th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Discount</th><th>Total</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <table class="totals"><tbody>
      <tr><td>Subtotal</td><td>₹${fmt(Number(q.subtotal))}</td></tr>
      <tr><td>Discount</td><td>-₹${fmt(Number(q.discount))}</td></tr>
      <tr><td>Tax</td><td>₹${fmt(Number(q.taxAmount))}</td></tr>
      <tr><td>Grand Total</td><td>₹${fmt(Number(q.total))}</td></tr>
    </tbody></table>
    <div style="clear:both"></div>
    ${q.notes  ? `<div class="notes"><strong>Notes:</strong><br/>${esc(q.notes)}</div>` : ""}
    ${q.terms  ? `<div class="notes"><strong>Terms &amp; Conditions:</strong><br/>${esc(q.terms)}</div>` : ""}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="page-pad" style={{ minHeight: "100vh", background: "#070714" }}>
      {/* Header */}
      <div className="page-hdr" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FileText size={20} color="#818CF8" />
          </div>
          <div>
            <h1 style={S.title}>{ t('page_quotations') }</h1>
            <p style={S.subtitle}>Create and manage proposals for your customers</p>
          </div>
        </div>
        <button style={S.btn} onClick={openCreate}><Plus size={16} />New Quotation</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Total</div>
          <div style={{ ...S.kpiValue, color: "var(--text-primary)" }}>{stats?.total ?? "—"}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Draft</div>
          <div style={{ ...S.kpiValue, color: "#818cf8" }}>{stats?.draft ?? "—"}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Sent</div>
          <div style={{ ...S.kpiValue, color: "#60a5fa" }}>{stats?.sent ?? "—"}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Accepted</div>
          <div style={{ ...S.kpiValue, color: "#10b981" }}>{stats?.accepted ?? "—"}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Accepted Value</div>
          <div style={{ ...S.kpiValue, color: "#10b981", fontSize: 20 }}>₹{stats ? fmt(Number(stats.acceptedValue)) : "—"}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" as const }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
          <input
            style={{ ...S.input, paddingLeft: 32 }}
            placeholder="Search quotations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid",
                ...(statusFilter === s
                  ? { background: "#6366f1", borderColor: "#6366f1", color: "white" }
                  : { background: "transparent", borderColor: "var(--border-input)", color: "var(--text-ghost)" }),
              }}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div>
        ) : quotations.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <FileText size={40} color="var(--border)" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-ghost)", margin: 0 }}>No quotations yet. Create your first proposal.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Quotation #", "Subject", "Party", "Status", "Total", "Valid Until", "Actions"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id} style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#0A0A18")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={S.td}>
                      <span style={{ fontFamily: "monospace", color: "#818CF8", fontWeight: 700 }}>{q.quotationNumber}</span>
                    </td>
                    <td style={S.td}>{q.subject || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                    <td style={S.td}>{q.party?.name || <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <StatusBadge status={q.status} />
                        {STATUS_TRANSITIONS[q.status]?.length > 0 && (
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <select
                              style={{ background: "transparent", border: "none", color: "var(--text-ghost)", fontSize: 11, cursor: "pointer", outline: "none", colorScheme: "dark" }}
                              value=""
                              onChange={e => { if (e.target.value) handleStatusChange(q.id, e.target.value); }}
                            >
                              <option value="">▼</option>
                              {STATUS_TRANSITIONS[q.status].map(s => (
                                <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ ...S.td, fontWeight: 600, color: "var(--text-primary)" }}>₹{fmt(Number(q.total))}</td>
                    <td style={{ ...S.td, color: q.validUntil && new Date(q.validUntil) < new Date() ? "#ef4444" : "var(--text-sec)" }}>
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => openView(q.id)}
                          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8", padding: "5px 8px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={() => openQuotationPrint(q)}
                          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#34D399", padding: "5px 8px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                          title="Print / PDF"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", padding: "5px 8px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
          <div className="modal-inner" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 860, boxShadow: "0 32px 100px rgba(0,0,0,0.7)" }}>
            {/* Modal header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>New Quotation</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>Create a quotation with line items</p>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 4 }}><X size={20} /></button>
            </div>

            <div style={{ padding: "24px", display: "grid", gap: 18 }}>
              {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13 }}>{error}</div>}

              {/* Basic info */}
              <div className="grid-r2" style={{ gap: 16 }}>
                <div>
                  <label style={S.label}>Party / Customer</label>
                  <select style={S.select} value={form.partyId} onChange={e => setForm(p => ({ ...p, partyId: e.target.value }))}>
                    <option value="">— Select Party —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Subject</label>
                  <input style={S.input} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Quotation for bulk order" />
                </div>
              </div>

              <div>
                <label style={S.label}>Valid Until</label>
                <input type="date" style={{ ...S.input, width: "auto", minWidth: 200 }} value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} />
              </div>

              {/* Line Items */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <label style={{ ...S.label, margin: 0 }}>Line Items</label>
                  <button onClick={addItem} style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8", padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Plus size={13} /> Add Item
                  </button>
                </div>

                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  {/* Column headers */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 0.8fr 0.8fr 80px", gap: 0, background: "#0A0A18", padding: "8px 12px" }}>
                    {["Description / Product", "Product (optional)", "Qty", "Unit Price", "Tax %", "Discount", ""].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
                    ))}
                  </div>

                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 0.8fr 0.8fr 80px", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--bg-hover)", alignItems: "center" }}>
                      <input
                        style={{ ...S.input, padding: "7px 10px" }}
                        placeholder="Description"
                        value={item.description}
                        onChange={e => updateItem(idx, "description", e.target.value)}
                      />
                      <select
                        style={{ ...S.select, padding: "7px 10px" }}
                        value={item.productId || ""}
                        onChange={e => updateItem(idx, "productId", e.target.value)}
                      >
                        <option value="">— none —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</option>)}
                      </select>
                      <input style={{ ...S.input, padding: "7px 10px" }} type="number" min="0" step="0.01" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} onKeyDown={kDecimal} />
                      <input style={{ ...S.input, padding: "7px 10px" }} type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} onKeyDown={kDecimal} />
                      <input style={{ ...S.input, padding: "7px 10px" }} type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={e => updateItem(idx, "taxRate", e.target.value)} placeholder="%" onKeyDown={kDecimal} />
                      <input style={{ ...S.input, padding: "7px 10px" }} type="number" min="0" step="0.01" value={item.discount} onChange={e => updateItem(idx, "discount", e.target.value)} onKeyDown={kDecimal} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 4 }}>
                        <span style={{ fontSize: 12, color: "#818CF8", fontWeight: 600 }}>₹{calcItem(item).toFixed(2)}</span>
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 2 }}><X size={14} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <div style={{ background: "#0A0A18", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px", minWidth: 260, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "var(--text-faint)" }}>
                      <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#f59e0b" }}>
                        <span>Discount</span><span>-₹{totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, color: "var(--text-faint)" }}>
                      <span>Tax</span><span>₹{totalTax.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border)", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                      <span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid-r2" style={{ gap: 16 }}>
                <div>
                  <label style={S.label}>Notes</label>
                  <textarea style={{ ...S.input, height: 80, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." />
                </div>
                <div>
                  <label style={S.label}>Terms & Conditions</label>
                  <textarea style={{ ...S.input, height: 80, resize: "vertical" as const }} value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} placeholder="Payment terms, delivery, etc..." />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "1px solid var(--border-input)", color: "var(--text-sec)", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Creating..." : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewQt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
          <div className="modal-inner" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 760, boxShadow: "0 32px 100px rgba(0,0,0,0.7)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#818CF8" }}>{viewQt.quotationNumber}</span>
                <StatusBadge status={viewQt.status} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => openQuotationPrint(viewQt)}
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#34D399", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Printer size={14} /> Print / PDF
                </button>
                <button onClick={() => setViewQt(null)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={20} /></button>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              {/* Meta */}
              <div className="grid-r3" style={{ gap: 16, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 4 }}>Party</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{viewQt.party?.name || "—"}</div>
                  {viewQt.party?.email && <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>{viewQt.party.email}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 4 }}>Subject</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{viewQt.subject || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 4 }}>Valid Until</div>
                  <div style={{ fontSize: 14, color: viewQt.validUntil && new Date(viewQt.validUntil) < new Date() ? "#ef4444" : "var(--text-primary)" }}>
                    {viewQt.validUntil ? new Date(viewQt.validUntil).toLocaleDateString("en-IN") : "—"}
                  </div>
                </div>
              </div>

              {/* Items table */}
              {viewQt.items && viewQt.items.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 10 }}>Line Items</div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <div className="overflow-x-auto">
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#0A0A18" }}>
                          {["#", "Description", "Qty", "Unit Price", "Tax", "Discount", "Total"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {viewQt.items.map((item, i) => (
                          <tr key={i}>
                            <td style={{ ...S.td, color: "var(--text-ghost)" }}>{i + 1}</td>
                            <td style={S.td}>{item.description}</td>
                            <td style={S.td}>{item.quantity}</td>
                            <td style={S.td}>₹{fmt(Number(item.unitPrice))}</td>
                            <td style={S.td}>{item.taxRate}%</td>
                            <td style={{ ...S.td, color: "#f59e0b" }}>₹{fmt(Number(item.discount))}</td>
                            <td style={{ ...S.td, fontWeight: 600, color: "var(--text-primary)" }}>₹{fmt(Number(calcItem({ ...item, quantity: String(item.quantity), unitPrice: String(item.unitPrice), taxRate: String(item.taxRate), discount: String(item.discount) })))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: "#0A0A18", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px", minWidth: 240, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "var(--text-faint)" }}><span>Subtotal</span><span>₹{fmt(Number(viewQt.subtotal))}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#f59e0b" }}><span>Discount</span><span>-₹{fmt(Number(viewQt.discount))}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, color: "var(--text-faint)" }}><span>Tax</span><span>₹{fmt(Number(viewQt.taxAmount))}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border)", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}><span>Grand Total</span><span>₹{fmt(Number(viewQt.total))}</span></div>
                </div>
              </div>

              {/* Notes / Terms */}
              {(viewQt.notes || viewQt.terms) && (
                <div style={{ display: "grid", gridTemplateColumns: viewQt.notes && viewQt.terms ? "1fr 1fr" : "1fr", gap: 16, marginTop: 20 }}>
                  {viewQt.notes && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, background: "#0A0A18", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>{viewQt.notes}</div>
                    </div>
                  )}
                  {viewQt.terms && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 6 }}>Terms & Conditions</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, background: "#0A0A18", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>{viewQt.terms}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Status actions */}
              {STATUS_TRANSITIONS[viewQt.status]?.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-ghost)", alignSelf: "center" }}>Move to:</span>
                  {STATUS_TRANSITIONS[viewQt.status].map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => { handleStatusChange(viewQt.id, s); setViewQt(p => p ? { ...p, status: s } : p); }}
                        style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", background: cfg.bg, borderColor: cfg.color + "40", color: cfg.color }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
