import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { DollarSign, Plus, Trash2, RefreshCw, ArrowRight, X } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface Rate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  source: string;
}

interface Currency { code: string; name: string; symbol: string; }

function AddRateModal({ currencies, onClose, onAdded }: {
  currencies: Currency[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!rate) return;
    setSaving(true);
    try {
      await fetch(`${API}/currency`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": activeOrg?.id ?? "" },
        body: JSON.stringify({ fromCurrency: from, toCurrency: to, rate: Number(rate), effectiveDate: date }),
      });
      onAdded(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 400, border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Add Exchange Rate</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>From</label>
              <select value={from} onChange={e => setFrom(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                {currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <ArrowRight className="w-4 h-4 mt-5" style={{ color: "var(--text-ghost)" }} />
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>To</label>
              <select value={to} onChange={e => setTo(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
                {currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-r2" style={{ gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Rate (1 {from} = ? {to})</label>
              <input type="number" step="0.0001" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 83.50"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Effective Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
            </div>
          </div>
          {from !== to && rate && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "#6366f111", border: "1px solid #6366f133", fontSize: 12, color: "#818cf8" }}>
              1 {from} = {Number(rate).toFixed(4)} {to} · 1 {to} = {(1 / Number(rate)).toFixed(4)} {from}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !rate || from === to}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#6366f1", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: rate && from !== to ? 1 : 0.5 }}>
            {saving ? "Saving…" : "Add Rate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConvertPanel({ currencies, token, orgId }: { currencies: Currency[]; token: string; orgId: string }) {
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [amount, setAmount] = useState("100");
  const [result, setResult] = useState<{ converted: number | null; rate: number | null; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function convert() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/currency/convert?from=${from}&to=${to}&amount=${amount}`, {
        headers: { Authorization: `Bearer ${token}`, "x-organization-id": orgId },
      });
      const d = await r.json();
      setResult(d.data);
    } finally { setLoading(false); }
  }

  const fromCurr = currencies.find(c => c.code === from);
  const toCurr = currencies.find(c => c.code === to);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Currency Converter</h3>
      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ display: "block", marginTop: 4, width: 110, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>From</label>
          <select value={from} onChange={e => setFrom(e.target.value)}
            style={{ display: "block", marginTop: 4, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <ArrowRight className="w-4 h-4 mb-2" style={{ color: "var(--text-ghost)" }} />
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>To</label>
          <select value={to} onChange={e => setTo(e.target.value)}
            style={{ display: "block", marginTop: 4, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}>
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <button onClick={convert} disabled={loading}
          style={{ marginBottom: 0, padding: "7px 16px", borderRadius: 8, background: "#6366f1", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "…" : "Convert"}
        </button>
      </div>
      {result && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: result.error ? "#ef444411" : "#10b98111", border: `1px solid ${result.error ? "#ef444433" : "#10b98133"}` }}>
          {result.error ? (
            <p style={{ fontSize: 13, color: "#ef4444" }}>{result.error} — Add the rate above first.</p>
          ) : (
            <p style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>
              {fromCurr?.symbol}{Number(amount).toLocaleString("en-IN")} =&nbsp;
              {toCurr?.symbol}{result.converted?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-ghost)", marginLeft: 8 }}>
                (rate: {result.rate?.toFixed(4)})
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CurrencyPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [rates, setRates] = useState<Rate[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg?.id ?? "" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/currency`, { headers });
      const d = await r.json();
      setRates(d.data?.rates ?? []);
      setCurrencies(d.data?.currencies ?? []);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeOrg?.id]);

  useEffect(() => { load(); }, [load]);

  async function deleteRate(id: string) {
    await fetch(`${API}/currency/${id}`, { method: "DELETE", headers });
    setRates(prev => prev.filter(r => r.id !== id));
  }

  // Group by pair, show latest on top
  const grouped = rates.reduce<Record<string, Rate[]>>((acc, r) => {
    const key = `${r.fromCurrency}/${r.toCurrency}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div style={{ padding: "24px 28px", maxWidth: 860, margin: "0 auto" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_currency') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-ghost)" }}>Manage exchange rates for foreign currency transactions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} style={{ padding: "6px 10px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: "#6366f1", color: "#fff", border: "none", cursor: "pointer" }}>
            <Plus className="w-3.5 h-3.5" /> Add Rate
          </button>
        </div>
      </div>

      {/* Converter */}
      <div className="mb-5">
        <ConvertPanel currencies={currencies} token={token ?? ""} orgId={activeOrg?.id ?? ""} />
      </div>

      {/* Rates table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Exchange Rate History</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-ghost)" }} /></div>
        ) : rates.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-ghost)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No rates yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>Add exchange rates to support multi-currency invoicing</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {["Pair", "Rate", "1 Unit =", "Date", "Source", ""].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rates.map(r => {
                  const fromC = currencies.find(c => c.code === r.fromCurrency);
                  const toC   = currencies.find(c => c.code === r.toCurrency);
                  const isLatest = grouped[`${r.fromCurrency}/${r.toCurrency}`]?.[0]?.id === r.id;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", opacity: isLatest ? 1 : 0.6 }}>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{r.fromCurrency}</span>
                        <ArrowRight className="inline w-3 h-3 mx-1" style={{ color: "var(--text-ghost)" }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{r.toCurrency}</span>
                        {isLatest && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "#10b98122", color: "#10b981", fontWeight: 700 }}>LATEST</span>}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{r.rate.toFixed(4)}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                        {fromC?.symbol}1 = {toC?.symbol}{r.rate.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-ghost)" }}>
                        {new Date(r.effectiveDate).toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-ghost)" }}>{r.source}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <button onClick={() => deleteRate(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}>
                          <Trash2 className="w-3.5 h-3.5" />
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

      {showAdd && <AddRateModal currencies={currencies} onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
}
