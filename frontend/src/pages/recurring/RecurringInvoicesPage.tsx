import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Pause, Play, Trash2, Calendar, X } from "lucide-react";
import api from "@/lib/api";
import { useTranslation } from 'react-i18next';

interface RecurringItem { description: string; quantity: number; unitPrice: number; taxRate: number; discount: number; }
interface Party { id: string; name: string; }
interface RecurringInvoice {
  id: string;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  dayOfMonth: number;
  nextRunDate: string;
  subject?: string;
  items: RecurringItem[];
  total: number;
  isActive: boolean;
  autoSend: boolean;
  party?: Party | null;
}

const FREQ_LABEL: Record<string, string> = { WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly" };
const FREQ_COLOR: Record<string, string> = { WEEKLY: "#10b981", MONTHLY: "#6366f1", QUARTERLY: "#f59e0b", YEARLY: "#ef4444" };

const emptyForm = {
  partyId: "", frequency: "MONTHLY" as const, dayOfMonth: 1,
  nextRunDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  subject: "", autoSend: false,
  items: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 }],
  notes: "",
};

type FormState = typeof emptyForm;

function calcTotals(items: RecurringItem[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - i.discount / 100), 0);
  const taxAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - i.discount / 100) * (i.taxRate / 100), 0);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

const S = {
  input: { width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 },
  btn: (variant?: "primary" | "ghost") => ({
    display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
    ...(variant === "ghost"
      ? { background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" }
      : { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white" }),
  } as React.CSSProperties),
};

export default function RecurringInvoicesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ri, p] = await Promise.all([
        api.get("/finance/recurring/list"),
        api.get("/parties?limit=200"),
      ]);
      setItems(ri.data.data?.items || []);
      setParties(p.data.data?.parties || []);
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const setItem = (i: number, k: keyof RecurringItem, v: any) =>
    setForm(f => ({ ...f, items: f.items.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!form.items[0].description) return;
    setSaving(true);
    try {
      const totals = calcTotals(form.items);
      await api.post("/finance/recurring", { ...form, ...totals, partyId: form.partyId || undefined });
      setShowForm(false); setForm(emptyForm); load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const toggle = async (id: string, isActive: boolean) => {
    await api.patch(`/finance/recurring/${id}`, { isActive: !isActive });
    setItems(prev => prev.map(r => r.id === id ? { ...r, isActive: !isActive } : r));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this recurring invoice?")) return;
    await api.delete(`/finance/recurring/${id}`);
    setItems(prev => prev.filter(r => r.id !== id));
  };

  const totals = calcTotals(form.items);

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_recurring') }</h1>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 4 }}>Auto-generate invoices on a schedule</p>
        </div>
        <button style={S.btn("primary")} onClick={() => setShowForm(true)}>
          <Plus size={14} /> New Recurring Invoice
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <RefreshCw size={36} style={{ margin: "0 auto 12px", color: "var(--text-ghost)", opacity: 0.3, display: "block" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>No recurring invoices yet</p>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 6 }}>Create templates that auto-generate invoices on a schedule.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(inv => (
            <div key={inv.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, opacity: inv.isActive ? 1 : 0.6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{inv.subject || `Invoice for ${inv.party?.name || "—"}`}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${FREQ_COLOR[inv.frequency]}20`, color: FREQ_COLOR[inv.frequency] }}>
                    {FREQ_LABEL[inv.frequency]}
                  </span>
                  {!inv.isActive && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "var(--bg-hover)", color: "var(--text-ghost)" }}>Paused</span>}
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--text-ghost)" }}>
                  <span>{inv.party?.name || "No party"}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} />
                    Next: {new Date(inv.nextRunDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  <span>{inv.items.length} line item{inv.items.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", minWidth: 80, textAlign: "right" }}>
                ₹{inv.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => toggle(inv.id, inv.isActive)}
                  title={inv.isActive ? "Pause" : "Resume"}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--text-muted)" }}>
                  {inv.isActive ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button onClick={() => remove(inv.id)}
                  style={{ background: "none", border: "1px solid #ef444430", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#ef4444" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Recurring Invoice</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Row 1 */}
              <div className="grid-r2" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Party</label>
                  <select value={form.partyId} onChange={e => setField("partyId", e.target.value)} style={S.input}>
                    <option value="">— No party —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Subject</label>
                  <input value={form.subject} onChange={e => setField("subject", e.target.value)} placeholder="Monthly retainer invoice" style={S.input} />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid-r3" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Frequency</label>
                  <select value={form.frequency} onChange={e => setField("frequency", e.target.value)} style={S.input}>
                    {["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map(f => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Day of Month</label>
                  <input type="number" min={1} max={28} value={form.dayOfMonth} onChange={e => setField("dayOfMonth", Number(e.target.value))} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>First Run Date</label>
                  <input type="date" value={form.nextRunDate} onChange={e => setField("nextRunDate", e.target.value)} style={S.input} />
                </div>
              </div>

              {/* Items */}
              <div>
                <label style={S.label}>Line Items</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.items.map((item, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 80px 100px 70px 70px 32px", gap: 8, alignItems: "center" }}>
                      <input value={item.description} onChange={e => setItem(i, "description", e.target.value)} placeholder="Description" style={S.input} />
                      <input type="number" value={item.quantity} onChange={e => setItem(i, "quantity", Number(e.target.value))} placeholder="Qty" style={S.input} />
                      <input type="number" value={item.unitPrice} onChange={e => setItem(i, "unitPrice", Number(e.target.value))} placeholder="Unit Price" style={S.input} />
                      <input type="number" value={item.taxRate} onChange={e => setItem(i, "taxRate", Number(e.target.value))} placeholder="Tax %" style={S.input} />
                      <input type="number" value={item.discount} onChange={e => setItem(i, "discount", Number(e.target.value))} placeholder="Disc %" style={S.input} />
                      <button onClick={() => removeItem(i)} disabled={form.items.length === 1}
                        style={{ background: "none", border: "none", color: form.items.length === 1 ? "var(--text-ghost)" : "#ef4444", cursor: "pointer", padding: 4 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button onClick={addItem} style={{ ...S.btn("ghost"), alignSelf: "flex-start" }}>
                    <Plus size={13} /> Add Line Item
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div style={{ textAlign: "right", background: "var(--bg-hover)", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 4 }}>Subtotal: ₹{totals.subtotal.toFixed(2)} · Tax: ₹{totals.taxAmount.toFixed(2)}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Total: ₹{totals.total.toFixed(2)}</div>
              </div>

              {/* Options */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.autoSend} onChange={e => setField("autoSend", e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--text-sec)" }}>Auto-send invoice email to party when generated</span>
              </label>

              <div>
                <label style={S.label}>Notes</label>
                <textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowForm(false)} style={S.btn("ghost")}>Cancel</button>
                <button onClick={save} disabled={saving || !form.items[0].description} style={{ ...S.btn("primary"), opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Create Recurring Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
