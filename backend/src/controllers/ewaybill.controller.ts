import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, notFound, badRequest, serverError } from "../utils/response";

// ── Helpers ───────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, "0"); }

function fmtDate(d: Date | string) {
  const dt = new Date(d);
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

function stateCodeFromGSTIN(gstin: string) {
  return gstin?.substring(0, 2) ?? "27";
}

// ── Generate E-Way Bill JSON payload ──────────────────────────
// Follows NIC EWB API v1.0.3 format

export async function generateEWayBillPayload(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const invoiceId = String(req.params.id);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: { party: true, items: true, organization: true },
    });

    if (!invoice) { notFound(res, "Invoice not found"); return; }
    if (!invoice.organization.taxId) {
      badRequest(res, "Seller GSTIN (taxId) not set in organization settings");
      return;
    }

    const org = invoice.organization;
    const party = invoice.party;
    const sellerGSTIN = org.taxId!;
    const buyerGSTIN  = party?.gstin ?? "URP";

    const isInterState = party?.gstin
      ? stateCodeFromGSTIN(sellerGSTIN) !== stateCodeFromGSTIN(party.gstin)
      : false;

    // Calculate totals
    const assessableValue = invoice.subtotal - (invoice.discount ?? 0);
    const cgstValue  = isInterState ? 0 : (invoice.cgstAmount ?? 0);
    const sgstValue  = isInterState ? 0 : (invoice.sgstAmount ?? 0);
    const igstValue  = isInterState ? (invoice.igstAmount ?? 0) : 0;

    const payload = {
      supplyType: "O",          // Outward
      subSupplyType: "1",       // Supply
      docType: "INV",
      docNo: invoice.invoiceNumber,
      docDate: fmtDate(invoice.invoiceDate),
      fromGstin: sellerGSTIN,
      fromTrdName: org.name,
      fromAddr1: org.address ?? "",
      fromAddr2: "",
      fromPlace: org.city ?? "",
      fromPincode: Number(org.pincode ?? "400001"),
      fromStateCode: Number(org.gstStateCode ?? stateCodeFromGSTIN(sellerGSTIN)),
      actFromStateCode: Number(org.gstStateCode ?? stateCodeFromGSTIN(sellerGSTIN)),
      toGstin: buyerGSTIN,
      toTrdName: party?.name ?? "Consumer",
      toAddr1: party?.address ?? "",
      toAddr2: "",
      toPlace: party?.city ?? "",
      toPincode: Number(party?.pincode ?? "400001"),
      toStateCode: Number(party?.gstin ? stateCodeFromGSTIN(party.gstin) : stateCodeFromGSTIN(sellerGSTIN)),
      actToStateCode: Number(party?.gstin ? stateCodeFromGSTIN(party.gstin) : stateCodeFromGSTIN(sellerGSTIN)),
      totalValue: invoice.subtotal,
      cgstValue,
      sgstValue,
      igstValue,
      cessValue: 0,
      cessNonAdvolValue: 0,
      totInvValue: invoice.total,
      transMode: "1",           // Road (default)
      transDistance: 0,
      transporterName: "",
      transporterId: "",
      transDocNo: "",
      transDocDate: "",
      vehNo: "",
      vehType: "R",             // Regular
      itemList: invoice.items.map((item, idx) => ({
        itemNo: idx + 1,
        productName: item.description,
        productDesc: item.description,
        hsnCode: item.hsnCode ?? "999999",
        quantity: item.quantity,
        qtyUnit: "NOS",
        cgstRate: isInterState ? 0 : (item.cgstRate ?? 0),
        sgstRate: isInterState ? 0 : (item.sgstRate ?? 0),
        igstRate: isInterState ? (item.igstRate ?? item.taxRate ?? 0) : 0,
        cessRate: 0,
        cessAdvol: 0,
        taxableAmount: item.quantity * item.unitPrice - (item.discount ?? 0),
      })),
    };

    ok(res, { payload, invoiceNumber: invoice.invoiceNumber, existingEWB: invoice.eWayBillNumber });
  } catch (err) {
    serverError(res, err);
  }
}

// Save EWB number returned from NIC portal back to the invoice
export async function saveEWayBillNumber(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const invoiceId = String(req.params.id);
    const { ewbNo, validUpto } = req.body as { ewbNo: string; validUpto?: string };

    if (!ewbNo) { badRequest(res, "ewbNo is required"); return; }

    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: orgId } });
    if (!invoice) { notFound(res, "Invoice not found"); return; }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eWayBillNumber: ewbNo,
        notes: invoice.notes
          ? `${invoice.notes}\nEWB: ${ewbNo}${validUpto ? ` (valid till ${validUpto})` : ""}`
          : `EWB: ${ewbNo}${validUpto ? ` (valid till ${validUpto})` : ""}`,
      },
    });

    ok(res, { ewbNo, invoiceId });
  } catch (err) {
    serverError(res, err);
  }
}

// List invoices without an e-way bill (value >= 50,000 typically requires one)
export async function listPendingEWayBills(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        type: "SALES",
        status: { in: ["SENT", "PAID", "PARTIAL"] },
        eWayBillNumber: null,
        total: { gte: 50000 },  // EWB required for consignments >= ₹50,000
      },
      include: { party: { select: { name: true, gstin: true, city: true } } },
      orderBy: { invoiceDate: "desc" },
      take: 100,
    });

    ok(res, { invoices, total: invoices.length });
  } catch (err) {
    serverError(res, err);
  }
}
