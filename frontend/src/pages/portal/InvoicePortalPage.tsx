import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { FileText, Download, CreditCard, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface OrgInfo { name: string; email?: string; phone?: string; address?: string; city?: string; state?: string; pincode?: string; taxId?: string; logo?: string; }
interface PartyInfo { name: string; displayName?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; gstin?: string; }
interface InvoiceItem { id: string; description: string; quantity: number; unitPrice: number; taxRate: number; taxAmount: number; discount: number; total: number; hsnCode?: string; }
interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string;
  terms?: string;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  organization: OrgInfo;
  party?: PartyInfo;
  items: InvoiceItem[];
}

const STATUS_MAP: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  DRAFT:    { icon: Clock,         color: "#6366f1", bg: "#6366f122", label: "Draft" },
  SENT:     { icon: Clock,         color: "#0ea5e9", bg: "#0ea5e922", label: "Sent" },
  PAID:     { icon: CheckCircle,   color: "#10b981", bg: "#10b98122", label: "Paid" },
  PARTIAL:  { icon: RefreshCw,     color: "#f59e0b", bg: "#f59e0b22", label: "Partially Paid" },
  OVERDUE:  { icon: XCircle,       color: "#ef4444", bg: "#ef444422", label: "Overdue" },
  CANCELLED:{ icon: XCircle,       color: "#6b7280", bg: "#6b728022", label: "Cancelled" },
};

function fmt(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function printInvoice() { window.print(); }

export default function InvoicePortalPage() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/portal/invoice/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setInvoice(d.data);
        else setError(d.message ?? "Invoice not found");
      })
      .catch(() => setError("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handlePay() {
    if (!token || !invoice || invoice.balanceDue <= 0) return;
    setPaying(true);
    try {
      const r = await fetch(`${API}/portal/invoice/${token}/pay`, { method: "POST" });
      const d = await r.json();
      if (d.data?.paymentUrl) window.open(d.data.paymentUrl, "_blank");
    } finally { setPaying(false); }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#6366f1" }} />
    </div>
  );

  if (error || !invoice) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div className="text-center">
        <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#ef4444" }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{error ?? "Invoice not found"}</h2>
        <p style={{ color: "#64748b", marginTop: 8 }}>The link may have expired or is invalid.</p>
      </div>
    </div>
  );

  const statusInfo = STATUS_MAP[invoice.status] ?? STATUS_MAP.SENT;
  const StatusIcon = statusInfo.icon;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Invoice card */}
        <div id="invoice-print" style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>

          {/* Header bar */}
          <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", padding: "24px 32px", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{invoice.organization.name}</h1>
                {invoice.organization.address && <p style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{invoice.organization.address}, {invoice.organization.city}</p>}
                {invoice.organization.taxId && <p style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>GSTIN: {invoice.organization.taxId}</p>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.2)", borderRadius: 99, padding: "4px 12px" }}>
                  <StatusIcon style={{ width: 14, height: 14 }} />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{statusInfo.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice meta */}
          <div style={{ padding: "24px 32px", borderBottom: "1px solid #e2e8f0" }}>
            <div className="grid-r2" style={{ gap: 24 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Invoice To</p>
                <p style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>{invoice.party?.name ?? "Customer"}</p>
                {invoice.party?.email && <p style={{ fontSize: 13, color: "#64748b" }}>{invoice.party.email}</p>}
                {invoice.party?.phone && <p style={{ fontSize: 13, color: "#64748b" }}>{invoice.party.phone}</p>}
                {invoice.party?.address && <p style={{ fontSize: 13, color: "#64748b" }}>{invoice.party.address}, {invoice.party.city}</p>}
                {invoice.party?.gstin && <p style={{ fontSize: 12, color: "#94a3b8" }}>GSTIN: {invoice.party.gstin}</p>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Invoice Number</p>
                  <p style={{ fontWeight: 800, color: "#6366f1", fontSize: 16 }}>{invoice.invoiceNumber}</p>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Date</p>
                  <p style={{ fontSize: 13, color: "#1e293b" }}>{new Date(invoice.invoiceDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                {invoice.dueDate && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Due Date</p>
                    <p style={{ fontSize: 13, color: "#1e293b" }}>{new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={{ padding: "0 32px" }}>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  {["Description", "HSN", "Qty", "Rate", "Tax", "Amount"].map(h => (
                    <th key={h} style={{ padding: "12px 8px", textAlign: h === "Description" ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{item.description}</td>
                    <td style={{ padding: "12px 8px", fontSize: 12, color: "#94a3b8", textAlign: "right" }}>{item.hsnCode ?? "—"}</td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#1e293b", textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ padding: "12px 8px", fontSize: 13, color: "#1e293b", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(item.unitPrice)}</td>
                    <td style={{ padding: "12px 8px", fontSize: 12, color: "#64748b", textAlign: "right" }}>{item.taxRate}%</td>
                    <td style={{ padding: "12px 8px", fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Totals */}
          <div style={{ padding: "20px 32px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: 260 }}>
                {[
                  { label: "Subtotal", value: invoice.subtotal },
                  ...(invoice.discount > 0 ? [{ label: "Discount", value: -invoice.discount }] : []),
                  ...(invoice.cgstAmount > 0 ? [{ label: "CGST", value: invoice.cgstAmount }] : []),
                  ...(invoice.sgstAmount > 0 ? [{ label: "SGST", value: invoice.sgstAmount }] : []),
                  ...(invoice.igstAmount > 0 ? [{ label: "IGST", value: invoice.igstAmount }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#64748b" }}>
                    <span>{label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 800, color: "#1e293b", borderTop: "2px solid #e2e8f0", marginTop: 6 }}>
                  <span>Total</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(invoice.total)}</span>
                </div>
                {invoice.paidAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#10b981" }}>
                    <span>Paid</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>− {fmt(invoice.paidAmount)}</span>
                  </div>
                )}
                {invoice.balanceDue > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fef2f2", borderRadius: 8, marginTop: 6, fontSize: 14, fontWeight: 700, color: "#ef4444" }}>
                    <span>Balance Due</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(invoice.balanceDue)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div style={{ padding: "16px 32px 24px", borderTop: "1px solid #e2e8f0", display: "grid", gap: 12, gridTemplateColumns: invoice.notes && invoice.terms ? "1fr 1fr" : "1fr" }}>
              {invoice.notes && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Notes</p>
                  <p style={{ fontSize: 13, color: "#475569" }}>{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Terms & Conditions</p>
                  <p style={{ fontSize: 13, color: "#475569" }}>{invoice.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={printInvoice}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#475569", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <Download style={{ width: 16, height: 16 }} /> Download / Print
          </button>
          {invoice.balanceDue > 0 && invoice.status !== "CANCELLED" && (
            <button onClick={handlePay} disabled={paying}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 24px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
              <CreditCard style={{ width: 16, height: 16 }} />
              {paying ? "Redirecting…" : `Pay ${fmt(invoice.balanceDue)}`}
            </button>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 20 }}>
          Powered by BusinessOS · This is a secure invoice portal
        </p>
      </div>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
