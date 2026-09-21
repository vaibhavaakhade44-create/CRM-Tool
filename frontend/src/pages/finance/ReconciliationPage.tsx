import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { RefreshCw, Upload, CheckCircle, XCircle, Clock, Zap, Trash2, X, AlertCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface BankTxn {
  id: string;
  accountName: string;
  txnDate: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  reference?: string;
  reconcileStatus: "UNMATCHED" | "MATCHED" | "IGNORED";
  matchedInvoiceId?: string;
  matchedPaymentId?: string;
  notes?: string;
}

interface Stats {
  total: number;
  unmatched: number;
  matched: number;
  ignored: number;
  creditTotal: number;
  debitTotal: number;
}

const STATUS_MAP = {
  UNMATCHED: { icon: Clock,        color: "#f59e0b", bg: "#f59e0b22", label: "Unmatched" },
  MATCHED:   { icon: CheckCircle,  color: "#10b981", bg: "#10b98122", label: "Matched" },
  IGNORED:   { icon: XCircle,      color: "#6b7280", bg: "#6b728022", label: "Ignored" },
};

function fmt(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

// CSV parser for bank statements
// Expected columns: Date, Description, Amount, Type (CREDIT/DEBIT), Reference
function parseCSV(text: string): { txnDate: string; description: string; amount: number; type: "CREDIT" | "DEBIT"; reference?: string }[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
    const get = (keys: string[]) => {
      for (const k of keys) {
        const idx = header.indexOf(k);
        if (idx >= 0 && cols[idx]) return cols[idx];
      }
      return "";
    };
    const rawType = get(["type", "cr/dr", "txn type"]).toUpperCase();
    return {
      txnDate: get(["date", "txn date", "value date"]),
      description: get(["description", "narration", "particulars", "details"]),
      amount: Math.abs(parseFloat(get(["amount", "debit", "credit"]).replace(/,/g, "")) || 0),
      type: ((rawType.includes("CR") || rawType === "CREDIT") ? "CREDIT" : "DEBIT") as "CREDIT" | "DEBIT",
      reference: get(["reference", "ref no", "cheque no", "ref"]) || undefined,
    };
  }).filter(r => r.txnDate && r.description && r.amount > 0);
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [accountName, setAccountName] = useState("HDFC Current Account");
  const [rows, setRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState("");
  const [saving, setSaving] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string);
      if (!parsed.length) { setCsvError("No valid rows found. Expected columns: Date, Description, Amount, Type."); return; }
      setCsvError("");
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function submit() {
    if (!rows.length || !accountName) return;
    setSaving(true);
    try {
      await fetch(`${API}/reconciliation/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": activeOrg?.id ?? "" },
        body: JSON.stringify({ accountName, rows }),
      });
      onImported(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 500, border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Import Bank Statement (CSV)</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>Account Name / Label</label>
            <input value={accountName} onChange={e => setAccountName(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const }}>CSV File</label>
            <input type="file" accept=".csv" onChange={onFile}
              style={{ display: "block", marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }} />
            {csvError && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{csvError}</p>}
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#6366f111", border: "1px solid #6366f133", fontSize: 12, color: "#818cf8" }}>
            Expected CSV headers: <strong>Date, Description, Amount, Type</strong> (CREDIT/DEBIT) and optional Reference.
          </div>
          {rows.length > 0 && (
            <p style={{ fontSize: 12, color: "#10b981" }}>✓ {rows.length} transactions ready to import</p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !rows.length}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#6366f1", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: rows.length ? 1 : 0.5 }}>
            {saving ? "Importing…" : `Import ${rows.length} rows`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [txns, setTxns] = useState<BankTxn[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [autoMatching, setAutoMatching] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg?.id ?? "" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const r = await fetch(`${API}/reconciliation${q}`, { headers });
      const d = await r.json();
      setTxns(d.data?.transactions ?? []);
      setStats(d.data?.stats ?? null);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeOrg?.id, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function autoMatch() {
    setAutoMatching(true);
    try {
      const r = await fetch(`${API}/reconciliation/auto-match`, { method: "POST", headers });
      const d = await r.json();
      alert(`Auto-matched ${d.data?.matched ?? 0} of ${d.data?.total ?? 0} transactions`);
      load();
    } finally { setAutoMatching(false); }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`${API}/reconciliation/${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ reconcileStatus: status }),
    });
    setTxns(prev => prev.map(t => t.id === id ? { ...t, reconcileStatus: status as any } : t));
  }

  async function deleteTxn(id: string) {
    await fetch(`${API}/reconciliation/${id}`, { method: "DELETE", headers });
    setTxns(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1080, margin: "0 auto" }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_reconciliation') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-ghost)" }}>Match bank transactions against invoices and payments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} disabled={loading} style={{ padding: "7px 10px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}>
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button onClick={autoMatch} disabled={autoMatching} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: "#6366f1", color: "#fff", border: "none", cursor: "pointer", opacity: autoMatching ? 0.7 : 1 }}>
            <Zap className="w-3.5 h-3.5" /> {autoMatching ? "Matching…" : "Auto-Match"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
          {[
            { label: "Total", value: stats.total, color: "var(--text-primary)" },
            { label: "Unmatched", value: stats.unmatched, color: "#f59e0b" },
            { label: "Matched", value: stats.matched, color: "#10b981" },
            { label: "Ignored", value: stats.ignored, color: "#6b7280" },
            { label: "Credits", value: fmt(stats.creditTotal), color: "#10b981" },
            { label: "Debits", value: fmt(stats.debitTotal), color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["ALL", "UNMATCHED", "MATCHED", "IGNORED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: "5px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: statusFilter === s ? "#6366f1" : "var(--bg-hover)",
              color: statusFilter === s ? "#fff" : "var(--text-secondary)" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-ghost)" }} /></div>
        ) : txns.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-ghost)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No transactions found</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>Import a bank statement CSV to start reconciling</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {["Date", "Account", "Description", "Reference", "Amount", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.map(t => {
                  const s = STATUS_MAP[t.reconcileStatus];
                  const StatusIcon = s.icon;
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 10px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {new Date(t.txnDate).toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: "var(--text-ghost)" }}>{t.accountName}</td>
                      <td style={{ padding: "9px 10px", fontSize: 12, color: "var(--text-primary)", maxWidth: 220 }}>
                        <p className="truncate">{t.description}</p>
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: "var(--text-ghost)" }}>{t.reference ?? "—"}</td>
                      <td style={{ padding: "9px 10px", fontSize: 12, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums",
                        color: t.type === "CREDIT" ? "#10b981" : "#ef4444" }}>
                        {t.type === "CREDIT" ? "+" : "−"}{fmt(t.amount)}
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, fontWeight: 700 }}>
                          <StatusIcon style={{ width: 10, height: 10 }} />
                          {s.label}
                        </span>
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        <div className="flex gap-1">
                          {t.reconcileStatus !== "MATCHED" && (
                            <button onClick={() => updateStatus(t.id, "MATCHED")}
                              style={{ padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: "#10b98122", color: "#10b981" }}>
                              Match
                            </button>
                          )}
                          {t.reconcileStatus !== "IGNORED" && (
                            <button onClick={() => updateStatus(t.id, "IGNORED")}
                              style={{ padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: "#6b728022", color: "#9ca3af" }}>
                              Ignore
                            </button>
                          )}
                          {t.reconcileStatus !== "UNMATCHED" && (
                            <button onClick={() => updateStatus(t.id, "UNMATCHED")}
                              style={{ padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, background: "var(--bg-hover)", color: "var(--text-ghost)" }}>
                              Unmatch
                            </button>
                          )}
                          <button onClick={() => deleteTxn(t.id)}
                            style={{ padding: "3px 6px", borderRadius: 6, border: "none", cursor: "pointer", background: "var(--bg-hover)", color: "var(--text-ghost)" }}>
                            <Trash2 style={{ width: 11, height: 11 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={load} />}
    </div>
  );
}
