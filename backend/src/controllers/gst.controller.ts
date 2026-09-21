import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, badRequest, serverError } from "../utils/response";

// Indian state code map (GST 2-digit codes)
const STATE_CODE_MAP: Record<string, string> = {
  "andhra pradesh": "37", "arunachal pradesh": "12", "assam": "18", "bihar": "10",
  "chhattisgarh": "22", "goa": "30", "gujarat": "24", "haryana": "06",
  "himachal pradesh": "02", "jharkhand": "20", "karnataka": "29", "kerala": "32",
  "madhya pradesh": "23", "maharashtra": "27", "manipur": "14", "meghalaya": "17",
  "mizoram": "15", "nagaland": "13", "odisha": "21", "punjab": "03",
  "rajasthan": "08", "sikkim": "11", "tamil nadu": "33", "telangana": "36",
  "tripura": "16", "uttar pradesh": "09", "uttarakhand": "05", "west bengal": "19",
  "delhi": "07", "jammu and kashmir": "01", "ladakh": "38",
  "chandigarh": "04", "dadra and nagar haveli": "26", "daman and diu": "25",
  "lakshadweep": "31", "puducherry": "34", "andaman and nicobar": "35",
};

function getStateCode(state?: string | null): string {
  if (!state) return "07";
  return STATE_CODE_MAP[state.toLowerCase().trim()] || "07";
}

function getDateRange(month: number, year: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  return { from, to };
}

// ── GSTR-1: Outward Supplies ──────────────────────────────────
export async function getGSTR1(req: OrgRequest, res: Response): Promise<void> {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { from, to } = getDateRange(month, year);

    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      select: { state: true, gstStateCode: true, taxId: true, name: true },
    });
    const orgStateCode = org?.gstStateCode || getStateCode(org?.state);

    // Fetch all SALES invoices in the period (exclude DRAFT, CANCELLED)
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: req.organizationId!,
        type: "SALES",
        status: { notIn: ["DRAFT", "CANCELLED"] },
        invoiceDate: { gte: from, lte: to },
      },
      include: {
        party: { select: { name: true, gstin: true, state: true } },
        items: true,
      },
      orderBy: { invoiceDate: "asc" },
    });

    // Compute GST split per invoice
    const processed = invoices.map((inv) => {
      const partyStateCode = inv.party?.gstin ? inv.party.gstin.substring(0, 2) : getStateCode(inv.party?.state);
      const isInterState = partyStateCode !== orgStateCode;

      // Sum item-level tax
      const taxableValue = inv.subtotal - inv.discount;
      const igst = isInterState ? inv.taxAmount : 0;
      const cgst = !isInterState ? inv.taxAmount / 2 : 0;
      const sgst = !isInterState ? inv.taxAmount / 2 : 0;

      return {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        partyName: inv.party?.name || "Unknown",
        partyGSTIN: inv.party?.gstin || "",
        placeOfSupply: inv.placeOfSupply || partyStateCode,
        isInterState,
        taxableValue: parseFloat(taxableValue.toFixed(2)),
        igst: parseFloat(igst.toFixed(2)),
        cgst: parseFloat(cgst.toFixed(2)),
        sgst: parseFloat(sgst.toFixed(2)),
        total: parseFloat(inv.total.toFixed(2)),
        type: inv.type,
      };
    });

    // B2B: parties with GSTIN
    const b2b = processed.filter((i) => i.partyGSTIN);
    // B2C Large: taxable value > 2.5L, no GSTIN
    const b2cLarge = processed.filter((i) => !i.partyGSTIN && i.taxableValue > 250000);
    // B2C Small: rest
    const b2cSmall = processed.filter((i) => !i.partyGSTIN && i.taxableValue <= 250000);

    // HSN Summary — group by HSN code from items
    const hsnMap: Record<string, { hsnCode: string; description: string; totalQty: number; taxableValue: number; igst: number; cgst: number; sgst: number }> = {};
    for (const inv of invoices) {
      const partyStateCode = inv.party?.gstin ? inv.party.gstin.substring(0, 2) : getStateCode(inv.party?.state);
      const isInterState = partyStateCode !== orgStateCode;
      for (const item of inv.items) {
        const key = item.hsnCode || "0000";
        if (!hsnMap[key]) hsnMap[key] = { hsnCode: key, description: item.description, totalQty: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
        const taxable = item.quantity * item.unitPrice - item.discount;
        hsnMap[key].totalQty += item.quantity;
        hsnMap[key].taxableValue += taxable;
        if (isInterState) hsnMap[key].igst += item.taxAmount;
        else { hsnMap[key].cgst += item.taxAmount / 2; hsnMap[key].sgst += item.taxAmount / 2; }
      }
    }

    // Totals
    const totals = {
      taxableValue: processed.reduce((s, i) => s + i.taxableValue, 0),
      igst: processed.reduce((s, i) => s + i.igst, 0),
      cgst: processed.reduce((s, i) => s + i.cgst, 0),
      sgst: processed.reduce((s, i) => s + i.sgst, 0),
      total: processed.reduce((s, i) => s + i.total, 0),
      invoiceCount: processed.length,
    };

    ok(res, {
      period: { month, year },
      orgGSTIN: org?.taxId || "",
      orgName: org?.name || "",
      b2b, b2cLarge, b2cSmall,
      hsnSummary: Object.values(hsnMap),
      totals,
    });
  } catch (err) {
    serverError(res, err);
  }
}

// ── GSTR-3B: Monthly Summary ─────────────────────────────────
export async function getGSTR3B(req: OrgRequest, res: Response): Promise<void> {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { from, to } = getDateRange(month, year);

    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      select: { state: true, gstStateCode: true, taxId: true, name: true },
    });
    const orgStateCode = org?.gstStateCode || getStateCode(org?.state);

    // Outward supplies (sales invoices)
    const salesInvoices = await prisma.invoice.findMany({
      where: {
        organizationId: req.organizationId!,
        type: "SALES",
        status: { notIn: ["DRAFT", "CANCELLED"] },
        invoiceDate: { gte: from, lte: to },
      },
      include: { party: { select: { gstin: true, state: true } } },
    });

    let outwardIGST = 0, outwardCGST = 0, outwardSGST = 0, outwardTaxable = 0;
    for (const inv of salesInvoices) {
      const partyStateCode = inv.party?.gstin ? inv.party.gstin.substring(0, 2) : getStateCode(inv.party?.state);
      const isInterState = partyStateCode !== orgStateCode;
      const taxable = inv.subtotal - inv.discount;
      outwardTaxable += taxable;
      if (isInterState) outwardIGST += inv.taxAmount;
      else { outwardCGST += inv.taxAmount / 2; outwardSGST += inv.taxAmount / 2; }
    }

    // ITC — from purchase invoices
    const purchaseInvoices = await prisma.invoice.findMany({
      where: {
        organizationId: req.organizationId!,
        type: "PURCHASE",
        status: { notIn: ["DRAFT", "CANCELLED"] },
        invoiceDate: { gte: from, lte: to },
      },
      include: { party: { select: { gstin: true, state: true } } },
    });

    let itcIGST = 0, itcCGST = 0, itcSGST = 0, itcTaxable = 0;
    for (const inv of purchaseInvoices) {
      const partyStateCode = inv.party?.gstin ? inv.party.gstin.substring(0, 2) : getStateCode(inv.party?.state);
      const isInterState = partyStateCode !== orgStateCode;
      itcTaxable += inv.subtotal - inv.discount;
      if (isInterState) itcIGST += inv.taxAmount;
      else { itcCGST += inv.taxAmount / 2; itcSGST += inv.taxAmount / 2; }
    }

    const netIGST = Math.max(0, outwardIGST - itcIGST);
    const netCGST = Math.max(0, outwardCGST - itcCGST);
    const netSGST = Math.max(0, outwardSGST - itcSGST);

    ok(res, {
      period: { month, year },
      orgGSTIN: org?.taxId || "",
      orgName: org?.name || "",
      outward: {
        taxableValue: parseFloat(outwardTaxable.toFixed(2)),
        igst: parseFloat(outwardIGST.toFixed(2)),
        cgst: parseFloat(outwardCGST.toFixed(2)),
        sgst: parseFloat(outwardSGST.toFixed(2)),
        total: parseFloat((outwardIGST + outwardCGST + outwardSGST).toFixed(2)),
        invoiceCount: salesInvoices.length,
      },
      itc: {
        taxableValue: parseFloat(itcTaxable.toFixed(2)),
        igst: parseFloat(itcIGST.toFixed(2)),
        cgst: parseFloat(itcCGST.toFixed(2)),
        sgst: parseFloat(itcSGST.toFixed(2)),
        total: parseFloat((itcIGST + itcCGST + itcSGST).toFixed(2)),
        invoiceCount: purchaseInvoices.length,
      },
      netTax: {
        igst: parseFloat(netIGST.toFixed(2)),
        cgst: parseFloat(netCGST.toFixed(2)),
        sgst: parseFloat(netSGST.toFixed(2)),
        total: parseFloat((netIGST + netCGST + netSGST).toFixed(2)),
      },
    });
  } catch (err) {
    serverError(res, err);
  }
}

// ── ITC Ledger (Input Tax Credit) ────────────────────────────
export async function getITCLedger(req: OrgRequest, res: Response): Promise<void> {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { from, to } = getDateRange(month, year);

    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      select: { state: true, gstStateCode: true },
    });
    const orgStateCode = org?.gstStateCode || getStateCode(org?.state);

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: req.organizationId!,
        type: "PURCHASE",
        status: { notIn: ["DRAFT", "CANCELLED"] },
        invoiceDate: { gte: from, lte: to },
      },
      include: { party: { select: { name: true, gstin: true, state: true } } },
      orderBy: { invoiceDate: "asc" },
    });

    const entries = invoices.map((inv) => {
      const partyStateCode = inv.party?.gstin ? inv.party.gstin.substring(0, 2) : getStateCode(inv.party?.state);
      const isInterState = partyStateCode !== orgStateCode;
      return {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        vendorName: inv.party?.name || "Unknown",
        vendorGSTIN: inv.party?.gstin || "",
        taxableValue: parseFloat((inv.subtotal - inv.discount).toFixed(2)),
        igst: isInterState ? parseFloat(inv.taxAmount.toFixed(2)) : 0,
        cgst: !isInterState ? parseFloat((inv.taxAmount / 2).toFixed(2)) : 0,
        sgst: !isInterState ? parseFloat((inv.taxAmount / 2).toFixed(2)) : 0,
        totalITC: parseFloat(inv.taxAmount.toFixed(2)),
      };
    });

    ok(res, { period: { month, year }, entries, total: entries.reduce((s, e) => s + e.totalITC, 0) });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Annual GST Summary ────────────────────────────────────────
export async function getAnnualSummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      select: { state: true, gstStateCode: true, taxId: true, name: true },
    });
    const orgStateCode = org?.gstStateCode || getStateCode(org?.state);

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const { from, to } = getDateRange(m, year);
      const [sales, purchases] = await Promise.all([
        prisma.invoice.findMany({
          where: { organizationId: req.organizationId!, type: "SALES", status: { notIn: ["DRAFT", "CANCELLED"] }, invoiceDate: { gte: from, lte: to } },
          include: { party: { select: { gstin: true, state: true } } },
        }),
        prisma.invoice.findMany({
          where: { organizationId: req.organizationId!, type: "PURCHASE", status: { notIn: ["DRAFT", "CANCELLED"] }, invoiceDate: { gte: from, lte: to } },
        }),
      ]);

      let outwardTax = 0;
      for (const inv of sales) { outwardTax += inv.taxAmount; }
      const itc = purchases.reduce((s, i) => s + i.taxAmount, 0);

      months.push({
        month: m,
        label: new Date(year, m - 1).toLocaleString("en-IN", { month: "short" }),
        outwardTaxable: sales.reduce((s, i) => s + (i.subtotal - i.discount), 0),
        outwardTax: parseFloat(outwardTax.toFixed(2)),
        itc: parseFloat(itc.toFixed(2)),
        netPayable: parseFloat(Math.max(0, outwardTax - itc).toFixed(2)),
        invoiceCount: sales.length,
      });
    }

    ok(res, { year, orgGSTIN: org?.taxId || "", months });
  } catch (err) {
    serverError(res, err);
  }
}
