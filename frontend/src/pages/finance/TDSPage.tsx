import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Plus, X, CheckCircle, Clock, IndianRupee } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
};

interface TDSEntry {
  id: string;
  type: "TDS" | "TCS";
  section: string;
  description?: string;
  baseAmount: number;
  tdsRate: number;
  tdsAmount: number;
  paymentDate: string;
  challanNumber?: string;
  isDeposited: boolean;
  depositedAt?: string;
  party?: { name: string };
  notes?: string;
}

interface Summary {
  totalTDS: { entries: number; base: number; amount: number; deposited: number; pending: number };
  totalTCS: { entries: number; base: number; amount: number; deposited: number; pending: number };
  bySection: Record<string, { base: number; amount: number; count: number }>;
}

interface Party { id: string; name: string; }

const TDS_SECTIONS = ["194C - Contractor", "194J - Professional", "194I - Rent", "194H - Commission", "194Q - Purchase", "192 - Salary", "194B - Lottery", "206C(1H) - TCS on Sale", "206C(1) - TCS on Scrap", "Other"];
const emptyForm = { type: "TDS", partyId: "", section: "", description: "", baseAmount: "", tdsRate: "", paymentDate: new Date().toISOString().slice(0, 10), challanNumber: "", isDeposited: false, depositedAt: "", notes: "" };

function fmt(n: number) { return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }); }

export default function TDSPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"TDS" | "TCS">("TDS");
  const [entries, setEntries] = useState<TDSEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, sRes, pRes] = await Promise.all([
        api.get(`/tds?type=${tab}`),
        api.get("/tds/summary"),
        api.get("/parties?limit=200"),
      ]);
      setEntries(eRes.data.data?.entries ?? []);
      setSummary(sRes.data.data);
      setParties(pRes.data.data?.parties ?? []);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.section || !form.baseAmount || !form.tdsRate) { setError("Section, base amount and rate are required"); return; }
    setSaving(true); setError("");
    try {
      await api.post("/tds", {
        ...form,
        baseAmount: parseFloat(form.baseAmount),
        tdsRate: parseFloat(form.tdsRate),
        partyId: form.partyId || undefined,
        isDeposited: form.isDeposited,
        depositedAt: form.isDeposited && form.depositedAt ? form.depositedAt : undefined,
      });
      setShowModal(false); load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const markDeposited = async (id: string) => {
    await api.patch(`/tds/${id}`, { isDeposited: true, depositedAt: new Date().toISOString().slice(0, 10) });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await api.delete(`/tds/${id}`);
    load();
  };

  const totals = tab === "TDS" ? summary?.totalTDS : summary?.totalTCS;
  const tdsRate = parseFloat(form.tdsRate || "0");
  const baseAmt = parseFloat(form.baseAmount || "0");
  const calcAmt = baseAmt && tdsRate ? (baseAmt * tdsRate / 100).toFixed(2) : "0.00";

  return (
    <div style={{ padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_tds') }</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-ghost)" }}>Manage tax deducted/collected at source per party and payment</p>
        </div>
        <button style={S.btn} onClick={() => { setShowModal(true); setForm({ ...emptyForm, type: tab }); setError(""); }}>
          <Plus size={15} /> Add Entry
        </button>
      </div>

      {/* KPI Cards */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Entries", value: totals.entries.toString(), color: "#818cf8" },
            { label: "Total Deducted", value: fmt(totals.amount), color: "#818cf8" },
            { label: "Deposited", value: fmt(totals.deposited), color: "#10b981" },
            { label: "Pending Deposit", value: fmt(totals.pending), color: totals.pending > 0 ? "#f59e0b" : "#10b981" },
          ].map(k => (
            <div key={k.label} style={S.kpi}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k.label}</p>
              <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-hover)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["TDS", "TCS"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === t ? "var(--bg-card)" : "transparent", color: tab === t ? "var(--text-primary)" : "var(--text-ghost)", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.25)" : "none" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>Loading…</div> : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-ghost)" }}>
            <IndianRupee size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ margin: 0 }}>No {tab} entries yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Section", "Party", "Base Amt", `${tab} Rate`, `${tab} Amt`, "Date", "Challan", "Status", "Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={S.td}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, background: "#6366f115", color: "#818cf8", padding: "2px 7px", borderRadius: 4 }}>{e.section.split(" ")[0]}</span>
                      {e.description && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-ghost)" }}>{e.description}</p>}
                    </td>
                    <td style={S.td}>{e.party?.name ?? <span style={{ color: "var(--text-ghost)" }}>—</span>}</td>
                    <td style={S.td}>{fmt(e.baseAmount)}</td>
                    <td style={S.td}>{e.tdsRate}%</td>
                    <td style={{ ...S.td, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(e.tdsAmount)}</td>
                    <td style={S.td}>{new Date(e.paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td style={S.td}>{e.challanNumber || "—"}</td>
                    <td style={S.td}>
                      {e.isDeposited ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#10b981", fontSize: 12, fontWeight: 600 }}><CheckCircle size={12} /> Deposited</span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#f59e0b", fontSize: 12, fontWeight: 600 }}><Clock size={12} /> Pending</span>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {!e.isDeposited && (
                          <button onClick={() => markDeposited(e.id)} style={{ fontSize: 11, color: "#10b981", background: "#10b98115", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>Mark Deposited</button>
                        )}
                        <button onClick={() => del(e.id)} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By Section Summary */}
      {summary && Object.keys(summary.bySection).length > 0 && (
        <div style={{ ...S.card, marginTop: 20 }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Summary by Section</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {Object.entries(summary.bySection).map(([sec, d]) => (
              <div key={sec} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#818cf8" }}>{sec}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-primary)", fontWeight: 700 }}>{fmt(d.amount)}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-ghost)" }}>{d.count} entries · Base: {fmt(d.base)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Add {tab} Entry</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X size={18} /></button>
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: "grid", gap: 14 }}>
              <div className="grid-r2" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Type</label>
                  <select value={form.type} onChange={e => setForm((p: any) => ({ ...p, type: e.target.value }))} style={{ ...S.input, colorScheme: "dark" }}>
                    <option value="TDS">TDS</option>
                    <option value="TCS">TCS</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Section *</label>
                  <select value={form.section} onChange={e => setForm((p: any) => ({ ...p, section: e.target.value }))} style={{ ...S.input, colorScheme: "dark" }}>
                    <option value="">Select section…</option>
                    {TDS_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={S.label}>Party / Vendor</label>
                <select value={form.partyId} onChange={e => setForm((p: any) => ({ ...p, partyId: e.target.value }))} style={{ ...S.input, colorScheme: "dark" }}>
                  <option value="">Select party…</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Description</label>
                <input value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} style={S.input} placeholder="e.g. Contractor payment for Jan 2025" />
              </div>
              <div className="grid-r3" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Base Amount *</label>
                  <input type="number" value={form.baseAmount} onChange={e => setForm((p: any) => ({ ...p, baseAmount: e.target.value }))} style={S.input} placeholder="0" />
                </div>
                <div>
                  <label style={S.label}>Rate % *</label>
                  <input type="number" value={form.tdsRate} onChange={e => setForm((p: any) => ({ ...p, tdsRate: e.target.value }))} style={S.input} placeholder="2" step="0.1" />
                </div>
                <div>
                  <label style={S.label}>{tab} Amount</label>
                  <input readOnly value={calcAmt} style={{ ...S.input, background: "#6366f110", color: "#818cf8", fontWeight: 700 }} />
                </div>
              </div>
              <div className="grid-r2" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Payment Date</label>
                  <input type="date" value={form.paymentDate} onChange={e => setForm((p: any) => ({ ...p, paymentDate: e.target.value }))} style={{ ...S.input, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={S.label}>Challan Number</label>
                  <input value={form.challanNumber} onChange={e => setForm((p: any) => ({ ...p, challanNumber: e.target.value }))} style={S.input} placeholder="Optional" />
                </div>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-sec)", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.isDeposited} onChange={e => setForm((p: any) => ({ ...p, isDeposited: e.target.checked }))} style={{ accentColor: "#6366f1" }} />
                  Already deposited with government
                </label>
              </div>
              {form.isDeposited && (
                <div>
                  <label style={S.label}>Deposit Date</label>
                  <input type="date" value={form.depositedAt} onChange={e => setForm((p: any) => ({ ...p, depositedAt: e.target.value }))} style={{ ...S.input, colorScheme: "dark" }} />
                </div>
              )}
              <div>
                <label style={S.label}>Notes</label>
                <input value={form.notes} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} style={S.input} placeholder="Optional notes" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-sec)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ ...S.btn, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Add Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
