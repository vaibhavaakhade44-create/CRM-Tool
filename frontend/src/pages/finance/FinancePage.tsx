import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Receipt, Plus, Search, X, TrendingUp, TrendingDown, Clock, CheckCircle, Printer, Download, CreditCard, Link } from "lucide-react";
import { generateInvoicePDF } from "@/lib/generatePDF";
import DocumentsButton from "@/components/DocumentsButton";
import { kDecimal } from "@/lib/fieldRules";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  kpiValue: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  tabs: { display: "flex", gap: 4, marginBottom: 24 } as React.CSSProperties,
  tab: (a: boolean) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: a ? "rgba(99,102,241,0.15)" : "transparent", color: a ? "#818CF8" : "var(--text-ghost)" }) as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16 } as React.CSSProperties,
  searchWrap: { position: "relative" as const, flex: 1, maxWidth: 300 },
  searchInput: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  searchIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
};

const INV_COLORS: Record<string, string> = { DRAFT: "#818cf8", SENT: "#60a5fa", PARTIAL: "#f59e0b", PAID: "#10b981", OVERDUE: "#ef4444", CANCELLED: "#6b7280" };

interface Summary { totalReceivable: number; totalPayable: number; paidInvoices: number; overdueInvoices: number; }
interface Invoice { id: string; invoiceNumber: string; type: string; status: string; invoiceDate: string; dueDate?: string; total: number; paidAmount: number; balanceDue: number; subtotal: number; taxAmount: number; discount: number; notes?: string; terms?: string; party?: { name: string; email?: string | null; phone?: string | null; mobile?: string | null; address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; gstin?: string | null; pan?: string | null } | null; items?: InvoiceItemDetail[]; payments?: PaymentDetail[]; }
interface InvoiceItemDetail { description: string; quantity: number; unitPrice: number; taxRate: number; taxAmount: number; discount: number; total: number; }
interface PaymentDetail { paymentDate: string; method: string; referenceNumber?: string; amount: number; }
interface Payment { id: string; amount: number; method: string; paymentDate: string; referenceNumber?: string; party?: { name: string } | null; invoice?: { invoiceNumber: string } | null; }
interface Party { id: string; name: string; }
interface OrgDetail { name: string; email?: string | null; phone?: string | null; address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; taxId?: string | null; panNumber?: string | null; iecCode?: string | null; currency: string; }

const emptyItem = { description: "", quantity: "1", unitPrice: "", taxRate: "18", discount: "0" };

function fmt(n: number, symbol: string) {
  return `${symbol}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function openInvoicePrint(inv: Invoice, org: OrgDetail) {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow popups for this site to print invoices."); return; }

  const symbol = org.currency === "INR" ? "₹" : org.currency || "₹";
  const f = (n: number) => fmt(n, symbol);

  const typeLabel: Record<string, string> = {
SALES: "TAX INVOICE", PURCHASE: "PURCHASE BILL", CREDIT_NOTE: "CREDIT NOTE", DEBIT_NOTE: "DEBIT NOTE" };

  const itemRows = (inv.items || []).map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${it.description}</td>
      <td style="text-align:right">${it.quantity}</td>
      <td style="text-align:right">${f(it.unitPrice)}</td>
      <td style="text-align:right">${it.discount > 0 ? f(it.discount) : "—"}</td>
      <td style="text-align:right">${it.taxRate}%</td>
      <td style="text-align:right">${f(it.taxAmount)}</td>
      <td style="text-align:right"><strong>${f(it.total)}</strong></td>
    </tr>`).join("");

  const payRows = (inv.payments || []).map(p => `
    <tr>
      <td>${fmtDate(p.paymentDate)}</td>
      <td>${p.method.replace(/_/g, " ")}</td>
      <td>${p.referenceNumber || "—"}</td>
      <td style="text-align:right">${f(p.amount)}</td>
    </tr>`).join("");

  const badgeColor: Record<string, string> = { PAID: "#d1fae5;color:#065f46", OVERDUE: "#fee2e2;color:#991b1b", DRAFT: "#ede9fe;color:#5b21b6", SENT: "#dbeafe;color:#1e40af", PARTIAL: "#fef3c7;color:#92400e", CANCELLED: "#f3f4f6;color:#374151" };
  const bc = badgeColor[inv.status] || "#f3f4f6;color:#374151";

  const orgAddr = [org.address, org.city, org.state, org.pincode].filter(Boolean).join(", ");
  const partyAddr = inv.party ? [inv.party.address, inv.party.city, inv.party.state, inv.party.pincode].filter(Boolean).join(", ") : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${inv.invoiceNumber} — ${org.name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
    .page{max-width:794px;margin:0 auto;padding:40px 48px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4f46e5;padding-bottom:20px;margin-bottom:24px}
    .co-name{font-size:22px;font-weight:800;color:#4f46e5;margin-bottom:4px}
    .co-detail{font-size:11px;color:#555;line-height:1.7}
    .inv-title{font-size:22px;font-weight:800;color:#1a1a1a;text-align:right}
    .inv-meta{font-size:12px;color:#555;text-align:right;margin-top:6px;line-height:1.9}
    .badge{display:inline-block;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700;background:${bc.split(";")[0]};${bc.includes("color") ? "color:" + bc.split("color:")[1] : ""}}
    .parties{display:flex;gap:24px;margin-bottom:24px}
    .party-box{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px}
    .party-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px}
    .party-name{font-size:14px;font-weight:700;color:#111;margin-bottom:4px}
    .party-detail{font-size:11px;color:#555;line-height:1.7}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    thead tr{background:#4f46e5;color:#fff}
    thead th{padding:9px 10px;font-size:11px;font-weight:700;text-align:left}
    tbody tr:nth-child(even){background:#f9fafb}
    tbody td{padding:9px 10px;font-size:12px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    .totals{display:flex;justify-content:flex-end;margin-bottom:24px}
    .totals-box{width:290px}
    .t-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #e5e7eb}
    .t-grand{display:flex;justify-content:space-between;padding:8px 0;font-size:15px;font-weight:800;color:#4f46e5;border-top:2px solid #4f46e5;margin-top:4px}
    .t-balance{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;font-weight:700;color:#dc2626}
    .t-paid-lbl{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;font-weight:700;color:#059669}
    .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:10px}
    .notes-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:12px;color:#555;line-height:1.7}
    .footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
    .print-btn{position:fixed;top:20px;right:20px;background:#4f46e5;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(79,70,229,.4)}
    .print-btn:hover{background:#4338ca}
    @media print{
      .no-print{display:none!important}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{padding:20px 24px}
    }
  </style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>
<div class="page">
  <div class="header">
    <div>
      <div class="co-name">${org.name}</div>
      <div class="co-detail">
        ${orgAddr || ""}${orgAddr ? "<br>" : ""}
        ${org.email ? `Email: ${org.email}` : ""}${org.email && org.phone ? " &nbsp;|&nbsp; " : ""}${org.phone ? `Phone: ${org.phone}` : ""}<br>
        ${org.taxId ? `GSTIN: <strong>${org.taxId}</strong>` : ""}${org.taxId && org.panNumber ? " &nbsp;|&nbsp; " : ""}${org.panNumber ? `PAN: ${org.panNumber}` : ""}${(org.taxId || org.panNumber) && org.iecCode ? " &nbsp;|&nbsp; " : ""}${org.iecCode ? `IEC: ${org.iecCode}` : ""}
      </div>
    </div>
    <div>
      <div class="inv-title">${typeLabel[inv.type] || "INVOICE"}</div>
      <div class="inv-meta">
        <strong>#${inv.invoiceNumber}</strong><br>
        Date: ${fmtDate(inv.invoiceDate)}<br>
        ${inv.dueDate ? `Due: ${fmtDate(inv.dueDate)}<br>` : ""}
        <span class="badge">${inv.status}</span>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party-box">
      <div class="party-label">Bill To</div>
      ${inv.party ? `
        <div class="party-name">${inv.party.name}</div>
        <div class="party-detail">
          ${partyAddr ? partyAddr + "<br>" : ""}
          ${inv.party.email ? `Email: ${inv.party.email}<br>` : ""}
          ${inv.party.phone || inv.party.mobile ? `Phone: ${inv.party.phone || inv.party.mobile}<br>` : ""}
          ${inv.party.gstin ? `GSTIN: <strong>${inv.party.gstin}</strong><br>` : ""}
          ${inv.party.pan ? `PAN: ${inv.party.pan}` : ""}
        </div>
      ` : `<div class="party-name" style="color:#9ca3af">Walk-in / Cash</div>`}
    </div>
    <div class="party-box">
      <div class="party-label">Invoice Details</div>
      <div class="party-detail" style="line-height:2">
        <strong>Invoice No:</strong> ${inv.invoiceNumber}<br>
        <strong>Date:</strong> ${fmtDate(inv.invoiceDate)}<br>
        ${inv.dueDate ? `<strong>Due Date:</strong> ${fmtDate(inv.dueDate)}<br>` : ""}
        <strong>Type:</strong> ${inv.type.replace(/_/g, " ")}<br>
        <strong>Currency:</strong> ${org.currency || "INR"}
      </div>
    </div>
  </div>

  <div class="sec-title">Line Items</div>
    <table>
    <thead>
      <tr>
        <th style="width:32px;text-align:center">#</th>
        <th>Description</th>
        <th style="text-align:right;width:55px">Qty</th>
        <th style="text-align:right;width:90px">Rate</th>
        <th style="text-align:right;width:80px">Discount</th>
        <th style="text-align:right;width:50px">Tax %</th>
        <th style="text-align:right;width:80px">Tax Amt</th>
        <th style="text-align:right;width:95px">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="t-row"><span>Subtotal</span><span>${f(inv.subtotal)}</span></div>
      ${inv.discount > 0 ? `<div class="t-row"><span>Discount</span><span style="color:#059669">– ${f(inv.discount)}</span></div>` : ""}
      ${inv.taxAmount > 0 ? `<div class="t-row"><span>Tax</span><span>${f(inv.taxAmount)}</span></div>` : ""}
      <div class="t-grand"><span>Grand Total</span><span>${f(inv.total)}</span></div>
      ${inv.paidAmount > 0 ? `<div class="t-paid-lbl"><span>Paid</span><span>– ${f(inv.paidAmount)}</span></div>` : ""}
      ${inv.balanceDue > 0 ? `<div class="t-balance"><span>Balance Due</span><span>${f(inv.balanceDue)}</span></div>` : `<div class="t-paid-lbl"><span>✓ Fully Paid</span><span></span></div>`}
    </div>
  </div>

  ${payRows ? `
    <div class="sec-title">Payment History</div>
      <table>
      <thead><tr><th>Date</th><th>Method</th><th>Reference #</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${payRows}</tbody>
    </table>
  ` : ""}

  ${inv.notes ? `<div class="sec-title">Notes</div><div class="notes-box">${inv.notes}</div>` : ""}
  ${inv.terms ? `<div class="sec-title">Terms &amp; Conditions</div><div class="notes-box">${inv.terms}</div>` : ""}

  <div class="footer">
    This is a computer-generated document. No physical signature is required.<br>
    Generated by BusinessOS &nbsp;·&nbsp; ${new Date().toLocaleString("en-IN")}
  </div>
</div>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
}

export default function FinancePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"invoices" | "payments">("invoices");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("SALES");
  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [form, setForm] = useState({ partyId: "", type: "SALES", invoiceDate: "", dueDate: "", notes: "" });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [payForm, setPayForm] = useState({ invoiceId: "", partyId: "", method: "BANK_TRANSFER", amount: "", referenceNumber: "", paymentDate: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, invRes, payRes, partyRes] = await Promise.all([
        api.get("/finance/summary"),
        api.get(`/finance?type=${typeFilter}&search=${search}&limit=100`),
        api.get("/finance/payments?limit=50"),
        api.get("/parties?limit=200"),
      ]);
      setSummary(sumRes.data.data);
      setInvoices(invRes.data.data.invoices);
      setPayments(payRes.data.data.payments);
      setParties(partyRes.data.data.parties);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = async (invoiceId: string) => {
    setPrintingId(invoiceId);
    try {
      const [invRes, orgRes] = await Promise.all([
        api.get(`/finance/${invoiceId}`),
        api.get("/organizations/current"),
      ]);
      openInvoicePrint(invRes.data.data, orgRes.data.data);
    } catch { /* ignore */ }
    setPrintingId(null);
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    setPrintingId(invoiceId + "_pdf");
    try {
      const [invRes, orgRes] = await Promise.all([
        api.get(`/finance/${invoiceId}`),
        api.get("/organizations/current"),
      ]);
      const inv = invRes.data.data;
      const org = orgRes.data.data;
      generateInvoicePDF({
        org: { name: org.name, address: org.address, city: org.city, state: org.state, taxId: org.taxId, phone: org.phone, email: org.email },
        party: { name: inv.party?.name || "Customer", address: inv.party?.address, city: inv.party?.city, state: inv.party?.state, gstin: inv.party?.gstin },
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        type: inv.type,
        status: inv.status,
        items: (inv.items || []).map((it: any) => ({ description: it.description, hsnCode: it.hsnCode, quantity: it.quantity, unitPrice: it.unitPrice, taxRate: it.taxRate, taxAmount: it.taxAmount, discount: it.discount, total: it.total })),
        subtotal: inv.subtotal,
        taxAmount: inv.taxAmount,
        discount: inv.discount,
        total: inv.total,
        paidAmount: inv.paidAmount,
        balanceDue: inv.balanceDue,
        notes: inv.notes,
        terms: inv.terms,
        placeOfSupply: inv.placeOfSupply,
        cgstAmount: inv.cgstAmount,
        sgstAmount: inv.sgstAmount,
        igstAmount: inv.igstAmount,
      });
    } catch { /* ignore */ }
    setPrintingId(null);
  };

  const handleShareLink = async (invoiceId: string) => {
    try {
      const res = await api.get(`/portal/link/${invoiceId}`);
      const url = res.data.data?.url;
      if (url) {
        await navigator.clipboard.writeText(url);
        alert(`Portal link copied!\n${url}`);
      }
    } catch { alert("Failed to generate portal link"); }
  };

  const handlePayNow = async (invoiceId: string) => {
    setPrintingId(invoiceId + "_pay");
    try {
      const res = await api.post("/payments/razorpay/create-link", { invoiceId });
      const { paymentUrl } = res.data.data;
      window.open(paymentUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to create payment link. Check Razorpay settings.");
    }
    setPrintingId(null);
  };

  const setItem = (i: number, k: string, v: string) => setItems(prev => prev.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const total = items.reduce((s, it) => {
    const line = parseFloat(it.quantity || "0") * parseFloat(it.unitPrice || "0");
    const disc = line * parseFloat(it.discount || "0") / 100;
    return s + (line - disc) * (1 + parseFloat(it.taxRate || "0") / 100);
  }, 0);

  const saveInvoice = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/finance", {
        partyId: form.partyId || undefined,
        type: form.type, invoiceDate: form.invoiceDate || undefined, dueDate: form.dueDate || undefined, notes: form.notes || undefined,
        items: items.map(it => ({ description: it.description, quantity: parseFloat(it.quantity), unitPrice: parseFloat(it.unitPrice), taxRate: parseFloat(it.taxRate), discount: parseFloat(it.discount) })),
      });
      setShowModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const savePayment = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/finance/payments", { ...payForm, amount: parseFloat(payForm.amount), invoiceId: payForm.invoiceId || undefined, partyId: payForm.partyId || undefined, paymentDate: payForm.paymentDate || undefined });
      setShowPayModal(false); load();
    } catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_finance') }</h1>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2 }}>Invoices, payments, and financial tracking</p>
        </div>
        <div className="hdr-actions">
          <button style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }} onClick={() => { setPayForm({ invoiceId: "", partyId: "", method: "BANK_TRANSFER", amount: "", referenceNumber: "", paymentDate: "", notes: "" }); setError(""); setShowPayModal(true); }}>
            <CheckCircle size={14} /> Record Payment
          </button>
          <button style={S.btn} onClick={() => { setForm({ partyId: "", type: "SALES", invoiceDate: "", dueDate: "", notes: "" }); setItems([{ ...emptyItem }]); setError(""); setShowModal(true); }}>
            <Plus size={15} /> New Invoice
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {[
          { label: "Receivable", value: summary ? `₹${summary.totalReceivable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—", icon: <TrendingUp size={18} color="#10b981" />, color: "#10b981" },
          { label: "Payable", value: summary ? `₹${summary.totalPayable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—", icon: <TrendingDown size={18} color="#ef4444" />, color: "#ef4444" },
          { label: "Paid Invoices", value: summary?.paidInvoices ?? "—", icon: <CheckCircle size={18} color="#6366f1" />, color: "#6366f1" },
          { label: "Overdue", value: summary?.overdueInvoices ?? "—", icon: <Clock size={18} color="#f59e0b" />, color: "#f59e0b" },
        ].map((k) => (
          <div key={k.label} style={S.kpi}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={S.kpiLabel}>{k.label}</span>
              <div style={{ padding: 6, borderRadius: 8, background: k.color + "20" }}>{k.icon}</div>
            </div>
            <div style={S.kpiValue}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={S.tabs}>
        <button style={S.tab(tab === "invoices")} onClick={() => setTab("invoices")}><Receipt size={14} style={{ display: "inline", marginRight: 6 }} />Invoices</button>
        <button style={S.tab(tab === "payments")} onClick={() => setTab("payments")}><CheckCircle size={14} style={{ display: "inline", marginRight: 6 }} />Payments</button>
      </div>

      <div style={S.card}>
        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <Search size={14} style={S.searchIcon} />
            <input style={S.searchInput} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {tab === "invoices" && (
            <select style={{ background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="SALES">Sales Invoices</option>
              <option value="PURCHASE">Purchase Bills</option>
              <option value="CREDIT_NOTE">Credit Notes</option>
            </select>
          )}
        </div>

        {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : tab === "invoices" ? (
          <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Invoice#", "Party", "Date", "Due Date", "Total", "Paid", "Balance", "Status", ""].map(h => <th key={h} style={{ ...S.th, whiteSpace: "nowrap" as const }}>{h}</th>)}</tr></thead>
            <tbody>
              {invoices.length === 0 ? <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No invoices yet.</td></tr> : invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ ...S.td, color: "#818CF8", fontWeight: 600 }}>{inv.invoiceNumber}</td>
                  <td style={S.td}>{inv.party?.name || "—"}</td>
                  <td style={S.td}>{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</td>
                  <td style={S.td}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td style={{ ...S.td, color: "var(--text-primary)", fontWeight: 600 }}>₹{inv.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td style={{ ...S.td, color: "#10b981" }}>₹{inv.paidAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td style={{ ...S.td, color: inv.balanceDue > 0 ? "#f59e0b" : "#10b981", fontWeight: 600 }}>₹{inv.balanceDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td style={S.td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: (INV_COLORS[inv.status] || "#818cf8") + "20", color: INV_COLORS[inv.status] || "#818cf8" }}>{inv.status}</span></td>
                  <td style={{ ...S.td, width: 100 }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <DocumentsButton entityType="INVOICE" entityId={inv.id} entityLabel={inv.invoiceNumber} />
                      <button
                        title="Print invoice"
                        onClick={() => handlePrint(inv.id)}
                        disabled={!!printingId}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center" }}
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        title="Download PDF"
                        onClick={() => handleDownloadPDF(inv.id)}
                        disabled={!!printingId}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center" }}
                      >
                        <Download size={15} />
                      </button>
                      {inv.balanceDue > 0 && inv.status !== "CANCELLED" && (
                        <button
                          title="Send Razorpay payment link"
                          onClick={() => handlePayNow(inv.id)}
                          disabled={printingId === inv.id + "_pay"}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "none", background: "#10b98120", color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                        >
                          <CreditCard size={12} /> Pay Now
                        </button>
                      )}
                      {inv.status !== "CANCELLED" && (
                        <button
                          title="Copy customer portal link"
                          onClick={() => handleShareLink(inv.id)}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "none", background: "#6366f120", color: "#818cf8", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                        >
                          <Link size={12} /> Share
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <div className="table-wrap"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Date", "Party", "Invoice", "Method", "Amount", "Ref#"].map(h => <th key={h} style={{ ...S.th, whiteSpace: "nowrap" as const }}>{h}</th>)}</tr></thead>
            <tbody>
              {payments.length === 0 ? <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "var(--text-ghost)", padding: 32 }}>No payments yet.</td></tr> : payments.map(p => (
                <tr key={p.id}>
                  <td style={S.td}>{new Date(p.paymentDate).toLocaleDateString("en-IN")}</td>
                  <td style={S.td}>{p.party?.name || "—"}</td>
                  <td style={{ ...S.td, color: "#818CF8" }}>{p.invoice?.invoiceNumber || "—"}</td>
                  <td style={S.td}>{p.method.replace("_", " ")}</td>
                  <td style={{ ...S.td, color: "#10b981", fontWeight: 600 }}>₹{p.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td style={{ ...S.td, fontFamily: "monospace", color: "#818CF8" }}>{p.referenceNumber || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Invoice Modal */}
      {showModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>New Invoice</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div><label style={S.label}>Type</label>
                  <select style={S.select} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="SALES">Sales Invoice</option>
                    <option value="PURCHASE">Purchase Bill</option>
                    <option value="CREDIT_NOTE">Credit Note</option>
                    <option value="DEBIT_NOTE">Debit Note</option>
                  </select>
                </div>
                <div><label style={S.label}>Party</label>
                  <select style={S.select} value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                    <option value="">— Select —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Invoice Date</label><input type="date" style={S.input} value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></div>
                <div><label style={S.label}>Due Date</label><input type="date" style={S.input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              </div>
              <div>
                <label style={{ ...S.label, marginBottom: 10 }}>Line Items</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8 }}>
                        <div><input style={S.input} value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} placeholder="Description" /></div>
                        <div><input type="number" style={S.input} value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} placeholder="Qty" onKeyDown={kDecimal} /></div>
                        <div><input type="number" style={S.input} value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", e.target.value)} placeholder="Rate ₹" onKeyDown={kDecimal} /></div>
                        <div>
                          <select style={S.select} value={it.taxRate} onChange={(e) => setItem(i, "taxRate", e.target.value)}>
                            {["0","5","12","18","28"].map(t => <option key={t} value={t}>{t}%</option>)}
                          </select>
                        </div>
                        <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} style={{ background: "#ef444420", border: "none", color: "#ef4444", borderRadius: 6, padding: "6px 8px", cursor: "pointer" }}><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setItems(prev => [...prev, { ...emptyItem }])} style={{ background: "var(--bg-hover)", border: "1px dashed #2a2a4a", color: "#818CF8", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}><Plus size={12} /> Add Line</button>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ color: "var(--text-ghost)", fontSize: 12 }}>Total: </span>
                <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 18 }}>₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={saveInvoice} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Create Invoice"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowPayModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>Record Payment</h3>
              <button onClick={() => setShowPayModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.label}>Link to Invoice</label>
                <select style={S.select} value={payForm.invoiceId} onChange={(e) => setPayForm({ ...payForm, invoiceId: e.target.value })}>
                  <option value="">— Optional —</option>
                  {invoices.filter(i => i.status !== "PAID").map(i => <option key={i.id} value={i.id}>{i.invoiceNumber} — ₹{i.balanceDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} due</option>)}
                </select>
              </div>
              <div><label style={S.label}>Party</label>
                <select style={S.select} value={payForm.partyId} onChange={(e) => setPayForm({ ...payForm, partyId: e.target.value })}>
                  <option value="">— Select —</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Amount ₹</label><input type="number" style={S.input} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
                <div><label style={S.label}>Method</label>
                  <select style={S.select} value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                    {["CASH","BANK_TRANSFER","CHEQUE","UPI","CARD","OTHER"].map(m => <option key={m} value={m}>{m.replace("_"," ")}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Date</label><input type="date" style={S.input} value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} /></div>
                <div><label style={S.label}>Reference#</label><input style={S.input} value={payForm.referenceNumber} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowPayModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={savePayment} style={S.btn} disabled={saving}>{saving ? "Saving..." : "Record Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
