import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { FileText, Download, CheckCircle, Clock, AlertCircle, Copy, RefreshCw, X } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface PendingInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: number;
  status: string;
  party?: { name: string; gstin?: string };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    SENT:    { bg: "#0ea5e922", color: "#0ea5e9", label: "Sent" },
    PAID:    { bg: "#10b98122", color: "#10b981", label: "Paid" },
    PARTIAL: { bg: "#f59e0b22", color: "#f59e0b", label: "Partial" },
  };
  const s = map[status] ?? { bg: "#6366f122", color: "#6366f1", label: status };
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function JsonModal({ payload, invoiceId, invoiceNumber, existingIRN, onClose, onSave }: {
  payload: object;
  invoiceId: string;
  invoiceNumber: string;
  existingIRN?: string;
  onClose: () => void;
  onSave: (irn: string) => void;
}) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [irn, setIrn] = useState(existingIRN ?? "");
  const [ackNo, setAckNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(payload, null, 2);

  function copyJSON() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadJSON() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `einvoice-${invoiceNumber}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function saveIRN() {
    if (!irn.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/einvoice/${invoiceId}/irn`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-organization-id": activeOrg?.id ?? "",
        },
        body: JSON.stringify({ irn: irn.trim(), ackNo }),
      });
      if (r.ok) { onSave(irn.trim()); onClose(); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>E-Invoice Payload — {invoiceNumber}</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>GSTN API-ready JSON (schema v1.1). Copy and submit to the IRP portal.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* JSON */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          <pre style={{ fontSize: 11, color: "#a5b4fc", background: "#0a0a1a", padding: 14, borderRadius: 10, margin: 0, overflowX: "auto", lineHeight: 1.6 }}>
            {json}
          </pre>
        </div>

        {/* IRN save */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 20px" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>After submitting to IRP, save the IRN here:</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={irn}
              onChange={e => setIrn(e.target.value)}
              placeholder="IRN (64-char hash from GSTN)"
              style={{ flex: 2, minWidth: 220, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }}
            />
            <input
              value={ackNo}
              onChange={e => setAckNo(e.target.value)}
              placeholder="Ack No (optional)"
              style={{ flex: 1, minWidth: 120, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={copyJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}>
              <Copy className="w-3 h-3" />
              {copied ? "Copied!" : "Copy JSON"}
            </button>
            <button onClick={downloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}>
              <Download className="w-3 h-3" />
              Download JSON
            </button>
            <button onClick={saveIRN} disabled={saving || !irn.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold ml-auto"
              style={{ background: "#6366f1", color: "#fff", border: "none", cursor: irn.trim() ? "pointer" : "not-allowed", opacity: irn.trim() ? 1 : 0.5 }}>
              <CheckCircle className="w-3 h-3" />
              {saving ? "Saving…" : "Save IRN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EInvoicePage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ payload: object; invoiceId: string; invoiceNumber: string; existingIRN?: string } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-organization-id": activeOrg?.id ?? "",
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/einvoice/pending`, { headers });
      const d = await r.json();
      setInvoices(d.data?.invoices ?? []);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeOrg?.id]);

  useEffect(() => { load(); }, [load]);

  async function generatePayload(inv: PendingInvoice) {
    setGenerating(inv.id);
    try {
      const r = await fetch(`${API}/einvoice/${inv.id}/payload`, { headers });
      const d = await r.json();
      if (d.data) {
        setModal({ payload: d.data.payload, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, existingIRN: d.data.existingIRN });
      }
    } finally {
      setGenerating(null);
    }
  }

  const irnsaved = (invoiceId: string) => {
    setInvoices(prev => prev.filter(i => i.id !== invoiceId));
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_einvoice') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-ghost)" }}>
            Generate GSTN-compliant e-invoice JSON for IRP submission
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl mb-5" style={{ background: "#6366f111", border: "1px solid #6366f133" }}>
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#818cf8" }} />
        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: "#818cf8" }}>How it works</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Click "Generate JSON" on any invoice to build the GSTN e-invoice payload. Copy or download the JSON, submit it to the IRP portal (portal.einvoice1.gst.gov.in), then paste the returned IRN and Ack No back here to save them on the invoice record.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { icon: Clock, label: "Pending IRN", value: invoices.length, color: "#f59e0b" },
          { icon: CheckCircle, label: "IRN Generated today", value: 0, color: "#10b981" },
          { icon: FileText, label: "Current FY invoices", value: invoices.length, color: "#6366f1" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon style={{ width: 18, height: 18, color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invoices pending IRN</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-ghost)" }} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#10b981", opacity: 0.5 }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>All caught up!</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>No invoices pending IRN generation for this FY</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {["Invoice #", "Date", "Party", "GSTIN", "Amount", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#818cf8" }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>
                      {new Date(inv.invoiceDate).toLocaleDateString("en-IN")}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>{inv.party?.name ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-ghost)" }}>{inv.party?.gstin ?? "Unregistered"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      ₹{Number(inv.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge status={inv.status} /></td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => generatePayload(inv)}
                        disabled={generating === inv.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: "#6366f1", color: "#fff", border: "none", cursor: generating === inv.id ? "wait" : "pointer", opacity: generating === inv.id ? 0.7 : 1, whiteSpace: "nowrap" }}
                      >
                        <FileText className="w-3 h-3" />
                        {generating === inv.id ? "Generating…" : "Generate JSON"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <JsonModal
          payload={modal.payload}
          invoiceId={modal.invoiceId}
          invoiceNumber={modal.invoiceNumber}
          existingIRN={modal.existingIRN}
          onClose={() => setModal(null)}
          onSave={irn => { irnsaved(modal.invoiceId); setModal(null); }}
        />
      )}
    </div>
  );
}
