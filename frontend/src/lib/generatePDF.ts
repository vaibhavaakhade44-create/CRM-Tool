import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface OrgInfo { name: string; address?: string; city?: string; state?: string; taxId?: string; phone?: string; email?: string; }
interface PartyInfo { name: string; address?: string; city?: string; state?: string; gstin?: string; }
interface LineItem { description: string; hsnCode?: string; quantity: number; unitPrice: number; taxRate: number; taxAmount: number; discount: number; total: number; }
interface InvoiceData {
  org: OrgInfo;
  party: PartyInfo;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  type: string;
  status: string;
  items: LineItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string;
  terms?: string;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  placeOfSupply?: string;
}

const ACCENT = [99, 102, 241] as [number, number, number]; // indigo
const DARK   = [13, 14, 26]  as [number, number, number];
const GRAY   = [120, 120, 150] as [number, number, number];
const LIGHT  = [240, 242, 250] as [number, number, number];

function fmt(n: number) { return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 0;

  // ── Header band ───────────────────────────────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.org.name, 14, 12);

  const typeLabel = data.type === "CREDIT_NOTE" ? "CREDIT NOTE" : data.type === "DEBIT_NOTE" ? "DEBIT NOTE" : "INVOICE";
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(typeLabel, W - 14, 10, { align: "right" });
  doc.setFontSize(8);
  doc.text(`# ${data.invoiceNumber}`, W - 14, 16, { align: "right" });
  const statusColor = data.status === "PAID" ? [16, 185, 129] : data.status === "OVERDUE" ? [239, 68, 68] : [245, 158, 11];
  doc.setTextColor(...(statusColor as [number, number, number]));
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(data.status.toUpperCase(), W - 14, 22, { align: "right" });

  y = 36;

  // ── Org + Party columns ──────────────────────────────────
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FROM", 14, y);
  doc.text("BILL TO", W / 2, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);

  const orgLines = [
    data.org.name,
    data.org.address,
    [data.org.city, data.org.state].filter(Boolean).join(", "),
    data.org.taxId ? `GSTIN: ${data.org.taxId}` : null,
    data.org.phone,
    data.org.email,
  ].filter(Boolean) as string[];

  const partyLines = [
    data.party.name,
    data.party.address,
    [data.party.city, data.party.state].filter(Boolean).join(", "),
    data.party.gstin ? `GSTIN: ${data.party.gstin}` : null,
  ].filter(Boolean) as string[];

  orgLines.forEach((line, i) => { doc.text(line, 14, y + i * 5); });
  partyLines.forEach((line, i) => { doc.text(line, W / 2, y + i * 5); });

  y += Math.max(orgLines.length, partyLines.length) * 5 + 6;

  // ── Invoice meta ─────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.roundedRect(14, y, W - 28, 16, 3, 3, "F");

  const metaItems = [
    ["Date", new Date(data.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
    data.dueDate ? ["Due Date", new Date(data.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })] : null,
    data.placeOfSupply ? ["Place of Supply", data.placeOfSupply] : null,
  ].filter(Boolean) as [string, string][];

  const colW = (W - 28) / metaItems.length;
  metaItems.forEach(([k, v], i) => {
    const x = 14 + i * colW + colW / 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(k.toUpperCase(), x, y + 5, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(v, x, y + 11, { align: "center" });
  });

  y += 22;

  // ── Items table ───────────────────────────────────────────
  const hasHSN = data.items.some(i => i.hsnCode);
  const columns = [
    { header: "#", dataKey: "no" },
    { header: "Description", dataKey: "desc" },
    ...(hasHSN ? [{ header: "HSN", dataKey: "hsn" }] : []),
    { header: "Qty", dataKey: "qty" },
    { header: "Rate", dataKey: "rate" },
    { header: "Tax%", dataKey: "tax" },
    { header: "Discount", dataKey: "disc" },
    { header: "Amount", dataKey: "total" },
  ];

  const rows = data.items.map((item, i) => ({
    no: (i + 1).toString(),
    desc: item.description,
    ...(hasHSN ? { hsn: item.hsnCode || "" } : {}),
    qty: item.quantity.toString(),
    rate: fmt(item.unitPrice),
    tax: `${item.taxRate}%`,
    disc: item.discount > 0 ? fmt(item.discount) : "—",
    total: fmt(item.total),
  }));

  autoTable(doc, {
    startY: y,
    head: [columns.map(c => c.header)],
    body: rows.map(r => columns.map(c => (r as any)[c.dataKey] || "")),
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 8 },
      [columns.length - 1]: { halign: "right" },
      [columns.length - 2]: { halign: "right" },
    },
    didDrawPage: () => {},
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Totals ────────────────────────────────────────────────
  const totalsX = W - 14;
  const totalsLabelX = W - 70;

  const totalsRows: [string, string, boolean?][] = [
    ["Subtotal", fmt(data.subtotal)],
    ...(data.discount > 0 ? [["Discount", `- ${fmt(data.discount)}`] as [string, string]] : []),
    ...(data.cgstAmount ? [["CGST", fmt(data.cgstAmount)] as [string, string]] : []),
    ...(data.sgstAmount ? [["SGST", fmt(data.sgstAmount)] as [string, string]] : []),
    ...(data.igstAmount ? [["IGST", fmt(data.igstAmount)] as [string, string]] : []),
    ...(!data.cgstAmount && !data.igstAmount ? [["Tax", fmt(data.taxAmount)] as [string, string]] : []),
    ["Total", fmt(data.total), true],
    ...(data.paidAmount > 0 ? [["Paid", `- ${fmt(data.paidAmount)}`] as [string, string]] : []),
    ...(data.balanceDue > 0 ? [["Balance Due", fmt(data.balanceDue), true] as [string, string, boolean]] : []),
  ];

  totalsRows.forEach(([label, value, bold]) => {
    doc.setFontSize(bold ? 10 : 8.5);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? DARK : GRAY));
    if (bold) {
      doc.setFillColor(...ACCENT);
      doc.setTextColor(255, 255, 255);
      doc.roundedRect(totalsLabelX - 4, y - 4, totalsX - totalsLabelX + 4, 10, 2, 2, "F");
    }
    doc.text(label, totalsLabelX, y + 2);
    doc.text(value, totalsX, y + 2, { align: "right" });
    y += 10;
  });

  y += 4;

  // ── GST split box ─────────────────────────────────────────
  if (data.cgstAmount || data.sgstAmount || data.igstAmount) {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(14, y, 90, data.igstAmount ? 16 : 22, 3, 3, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("TAX BREAKDOWN", 18, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    if (data.cgstAmount) { doc.text(`CGST: ${fmt(data.cgstAmount)}`, 18, y + 11); doc.text(`SGST: ${fmt(data.sgstAmount || 0)}`, 54, y + 11); }
    if (data.igstAmount) { doc.text(`IGST: ${fmt(data.igstAmount)}`, 18, y + 11); }
    y += data.igstAmount ? 22 : 28;
  }

  // ── Notes / Terms ─────────────────────────────────────────
  if (data.notes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("NOTES", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(data.notes, 14, y + 5, { maxWidth: W - 28 });
    y += 14;
  }
  if (data.terms) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("TERMS & CONDITIONS", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(data.terms, 14, y + 5, { maxWidth: W - 28 });
  }

  // ── Footer ────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 10, W, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text("Generated by BusinessOS", W / 2, pageH - 4, { align: "center" });

  doc.save(`${data.type.toLowerCase()}-${data.invoiceNumber}.pdf`);
}

export function generateQuotationPDF(data: Omit<InvoiceData, "type" | "status" | "paidAmount" | "balanceDue"> & { validUntil?: string }): void {
  generateInvoicePDF({ ...data, type: "QUOTATION", status: "DRAFT", paidAmount: 0, balanceDue: data.total });
}
