import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Truck, Download, CheckCircle, Copy, RefreshCw, X, AlertCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface PendingInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: number;
  status: string;
  party?: { name: string; gstin?: string; city?: string };
}

function JsonModal({ payload, invoiceId, invoiceNumber, existingEWB, onClose, onSave }: {
  payload: object;
  invoiceId: string;
  invoiceNumber: string;
  existingEWB?: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [ewbNo, setEwbNo] = useState(existingEWB ?? "");
  const [validUpto, setValidUpto] = useState("");
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
    a.href = url; a.download = `ewaybill-${invoiceNumber}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function save() {
    if (!ewbNo.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/ewaybill/${invoiceId}/ewb`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-organization-id": activeOrg?.id ?? "",
        },
        body: JSON.stringify({ ewbNo: ewbNo.trim(), validUpto }),
      });
      if (r.ok) { onSave(); onClose(); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>E-Way Bill JSON — {invoiceNumber}</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>NIC EWB API v1.0.3 format. Submit to ewaybillgst.gov.in then save the EWB number.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          <pre style={{ fontSize: 11, color: "#a5b4fc", background: "#0a0a1a", padding: 14, borderRadius: 10, margin: 0, overflowX: "auto", lineHeight: 1.6 }}>
            {json}
          </pre>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 20px" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>After generating on the portal, save the EWB number here:</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={ewbNo}
              onChange={e => setEwbNo(e.target.value)}
              placeholder="EWB Number (12 digits)"
              style={{ flex: 2, minWidth: 180, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }}
            />
            <input
              value={validUpto}
              onChange={e => setValidUpto(e.target.value)}
              placeholder="Valid upto (dd/mm/yyyy)"
              style={{ flex: 1, minWidth: 140, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12 }}
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
            <button onClick={save} disabled={saving || !ewbNo.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold ml-auto"
              style={{ background: "#10b981", color: "#fff", border: "none", cursor: ewbNo.trim() ? "pointer" : "not-allowed", opacity: ewbNo.trim() ? 1 : 0.5 }}>
              <CheckCircle className="w-3 h-3" />
              {saving ? "Saving…" : "Save EWB No."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EWayBillPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ payload: object; invoiceId: string; invoiceNumber: string; existingEWB?: string } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-organization-id": activeOrg?.id ?? "",
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/ewaybill/pending`, { headers });
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
      const r = await fetch(`${API}/ewaybill/${inv.id}/payload`, { headers });
      const d = await r.json();
      if (d.data) {
        setModal({ payload: d.data.payload, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, existingEWB: d.data.existingEWB });
      }
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_ewaybill') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-ghost)" }}>
            Generate NIC-format e-way bill JSON for consignments ≥ ₹50,000
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl mb-5" style={{ background: "#10b98111", border: "1px solid #10b98133" }}>
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#10b981" }} />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Showing invoices ≥ ₹50,000 that don't yet have an e-way bill number. Generate the JSON, submit it to <strong>ewaybillgst.gov.in</strong>, then save the 12-digit EWB number here. You can also update the transporter details and vehicle number in the JSON before submitting.
        </p>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invoices pending e-way bill</h3>
          <span className="text-xs" style={{ color: "var(--text-ghost)" }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-ghost)" }} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#10b981", opacity: 0.5 }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>All covered!</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>No invoices ≥ ₹50,000 pending an e-way bill</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {["Invoice #", "Date", "Party", "Destination", "Amount", ""].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#10b981" }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>
                      {new Date(inv.invoiceDate).toLocaleDateString("en-IN")}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>{inv.party?.name ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-ghost)" }}>{inv.party?.city ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      ₹{Number(inv.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => generatePayload(inv)}
                        disabled={generating === inv.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: "#10b981", color: "#fff", border: "none", cursor: generating === inv.id ? "wait" : "pointer", opacity: generating === inv.id ? 0.7 : 1, whiteSpace: "nowrap" }}
                      >
                        <Truck className="w-3 h-3" />
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
          existingEWB={modal.existingEWB}
          onClose={() => setModal(null)}
          onSave={() => { setInvoices(prev => prev.filter(i => i.id !== modal.invoiceId)); setModal(null); }}
        />
      )}
    </div>
  );
}
