import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { PiggyBank, Plus, Trash2, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface BudgetItem {
  id: string;
  category: string;
  allocatedAmount: number;
  spentAmount: number;
  notes?: string;
}

interface Budget {
  id: string;
  name: string;
  department?: string;
  fiscalYear: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  actualSpend?: number;
  utilisation?: number;
  notes?: string;
  items: BudgetItem[];
}

interface Summary {
  fiscalYear: string;
  budgets: number;
  totalAllocated: number;
  totalItemSpent: number;
  actualInvoiceSpend: number;
}

const FY_OPTIONS = ["2024-2025", "2025-2026", "2026-2027"];

function fmt(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function UtilBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color = pct > 100 ? "#ef4444" : pct > 80 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${clamped}%`, background: color, borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

const EMPTY_FORM = { name: "", department: "", fiscalYear: "2025-2026", startDate: "2025-04-01", endDate: "2026-03-31", totalBudget: "", notes: "" };
const EMPTY_ITEM = { category: "", allocatedAmount: "" };

function AddBudgetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function setItem(i: number, k: string, v: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  }
  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!form.name || !form.fiscalYear) return;
    setSaving(true);
    try {
      await fetch(`${API}/budgets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-organization-id": activeOrg?.id ?? "",
        },
        body: JSON.stringify({
          ...form,
          totalBudget: Number(form.totalBudget) || 0,
          items: items.filter(it => it.category).map(it => ({ category: it.category, allocatedAmount: Number(it.allocatedAmount) || 0 })),
        }),
      });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>New Budget</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
          {[
            { label: "Budget Name", key: "name", placeholder: "e.g. Marketing FY 2025-26" },
            { label: "Department", key: "department", placeholder: "e.g. Sales, HR, Operations" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>{label}</label>
              <input value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
          ))}
          <div className="grid-r2" style={{ gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Fiscal Year</label>
              <select value={form.fiscalYear} onChange={e => set("fiscalYear", e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                {FY_OPTIONS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Total Budget (₹)</label>
              <input type="number" value={form.totalBudget} onChange={e => set("totalBudget", e.target.value)} placeholder="0"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
          </div>
          <div className="grid-r2" style={{ gap: 10 }}>
            {[{ label: "Start Date", key: "startDate" }, { label: "End Date", key: "endDate" }].map(({ label, key }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>{label}</label>
                <input type="date" value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>
            ))}
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Budget Line Items</label>
              <button onClick={addItem} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer" }}>+ Add line</button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={it.category} onChange={e => setItem(i, "category", e.target.value)} placeholder="Category"
                  style={{ flex: 2, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }} />
                <input type="number" value={it.allocatedAmount} onChange={e => setItem(i, "allocatedAmount", e.target.value)} placeholder="Amount"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }} />
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !form.name}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#6366f1", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.name ? 1 : 0.5 }}>
            {saving ? "Creating…" : "Create Budget"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [fy, setFy] = useState("2025-2026");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-organization-id": activeOrg?.id ?? "",
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [br, sr] = await Promise.all([
        fetch(`${API}/budgets?fy=${fy}`, { headers }).then(r => r.json()),
        fetch(`${API}/budgets/summary?fy=${fy}`, { headers }).then(r => r.json()),
      ]);
      setBudgets(br.data?.budgets ?? []);
      setSummary(sr.data ?? null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeOrg?.id, fy]);

  useEffect(() => { load(); }, [load]);

  async function deleteBudget(id: string) {
    if (!confirm("Delete this budget?")) return;
    await fetch(`${API}/budgets/${id}`, {
      method: "DELETE",
      headers,
    });
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_budget') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-ghost)" }}>Department budgets vs actual spend tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={fy} onChange={e => setFy(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }}>
            {FY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <button onClick={load} disabled={loading}
            style={{ padding: "6px 10px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: "#6366f1", color: "#fff", border: "none", cursor: "pointer" }}>
            <Plus className="w-3.5 h-3.5" /> New Budget
          </button>
        </div>
      </div>

      {/* KPI row */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total Allocated", value: fmt(summary.totalAllocated), color: "#6366f1" },
            { label: "Invoice Spend", value: fmt(summary.actualInvoiceSpend), color: "#f59e0b" },
            { label: "Remaining", value: fmt(summary.totalAllocated - summary.actualInvoiceSpend), color: "#10b981" },
            { label: "Budgets", value: String(summary.budgets), color: "#0ea5e9" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-ghost)", textTransform: "uppercase", fontWeight: 700, fontSize: 10 }}>{label}</p>
              <p className="text-xl font-bold" style={{ color, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Budget cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-ghost)" }} />
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16">
          <PiggyBank className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-ghost)", opacity: 0.3 }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No budgets for {fy}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>Create your first budget to start tracking spend</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {budgets.map(b => {
            const pct = b.utilisation ?? 0;
            const over = pct > 100;
            const warn = pct > 80 && !over;
            return (
              <div key={b.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div className="flex items-start justify-between px-5 py-4" style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{b.name}</span>
                      {b.department && (
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "#6366f122", color: "#818cf8", fontWeight: 700 }}>{b.department}</span>
                      )}
                      {over && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                      {!over && pct >= 100 && <CheckCircle className="w-3.5 h-3.5" style={{ color: "#10b981" }} />}
                    </div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                        {new Date(b.startDate).toLocaleDateString("en-IN")} – {new Date(b.endDate).toLocaleDateString("en-IN")}
                      </span>
                      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        Allocated: {fmt(b.totalBudget)}
                      </span>
                      <span className="text-xs font-medium" style={{ color: over ? "#ef4444" : warn ? "#f59e0b" : "#10b981" }}>
                        Spent: {fmt(b.actualSpend ?? 0)} ({pct}%)
                      </span>
                    </div>
                    <UtilBar pct={pct} />
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteBudget(b.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", marginLeft: 12, flexShrink: 0 }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {expanded === b.id && b.items.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "12px 20px" }}>
                    <p className="text-xs font-bold mb-3" style={{ color: "var(--text-ghost)", textTransform: "uppercase" }}>Line Items</p>
                    <div style={{ display: "grid", gap: 8 }}>
                      {b.items.map(item => {
                        const itemPct = item.allocatedAmount > 0 ? Math.round((item.spentAmount / item.allocatedAmount) * 100) : 0;
                        return (
                          <div key={item.id}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{item.category}</span>
                              <span className="text-xs" style={{ color: itemPct > 100 ? "#ef4444" : "var(--text-secondary)" }}>
                                {fmt(item.spentAmount)} / {fmt(item.allocatedAmount)}
                              </span>
                            </div>
                            <UtilBar pct={itemPct} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddBudgetModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  );
}
