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

// Indian state code from 2-digit prefix of GSTIN
function stateCodeFromGSTIN(gstin: string) {
  return gstin?.substring(0, 2) ?? "27"; // default Maharashtra
}

// ── Generate IRN payload (GSTN schema v1.1) ───────────────────

export async function generateEInvoicePayload(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const invoiceId = String(req.params.id);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: {
        party: true,
        items: true,
        organization: true,
      },
    });

    if (!invoice) { notFound(res, "Invoice not found"); return; }
    if (invoice.type !== "SALES") { badRequest(res, "E-Invoice is only for outward sales invoices"); return; }

    const org = invoice.organization;
    const party = invoice.party;

    if (!org.taxId) { badRequest(res, "Seller GSTIN (taxId) not set in organization settings"); return; }

    // Build payload per GSTN schema
    const sellerGSTIN = org.taxId;
    const buyerGSTIN  = party?.gstin ?? "URP"; // Unregistered Person fallback

    const supplyType = invoice.reverseCharge ? "B2B" : "B2B";
    const isInterState = party?.gstin
      ? stateCodeFromGSTIN(sellerGSTIN) !== stateCodeFromGSTIN(party.gstin)
      : false;

    const payload = {
      Version: "1.1",
      TranDtls: {
        TaxSch: "GST",
        SupTyp: supplyType,
        RegRev: invoice.reverseCharge ? "Y" : "N",
        EcmGstin: null,
        IgstOnIntra: "N",
      },
      DocDtls: {
        Typ: "INV",
        No: invoice.invoiceNumber,
        Dt: fmtDate(invoice.invoiceDate),
      },
      SellerDtls: {
        Gstin: sellerGSTIN,
        LglNm: org.name,
        TrdNm: org.name,
        Addr1: org.address ?? "",
        Addr2: "",
        Loc: org.city ?? "",
        Pin: Number(org.pincode ?? "400001"),
        Stcd: org.gstStateCode ?? stateCodeFromGSTIN(sellerGSTIN),
        Ph: org.phone ?? "",
        Em: org.email ?? "",
      },
      BuyerDtls: {
        Gstin: buyerGSTIN,
        LglNm: party?.name ?? "Consumer",
        TrdNm: party?.displayName ?? party?.name ?? "Consumer",
        Pos: invoice.placeOfSupply ?? stateCodeFromGSTIN(sellerGSTIN),
        Addr1: party?.address ?? "",
        Addr2: "",
        Loc: party?.city ?? "",
        Pin: Number(party?.pincode ?? "400001"),
        Stcd: party?.gstin ? stateCodeFromGSTIN(party.gstin) : stateCodeFromGSTIN(sellerGSTIN),
        Ph: party?.phone ?? party?.mobile ?? "",
        Em: party?.email ?? "",
      },
      ItemList: invoice.items.map((item, idx) => ({
        SlNo: String(idx + 1),
        PrdDesc: item.description,
        IsServc: "N",
        HsnCd: item.hsnCode ?? "999999",
        Barcde: null,
        Qty: item.quantity,
        FreeQty: 0,
        Unit: "NOS",
        UnitPrice: item.unitPrice,
        TotAmt: item.quantity * item.unitPrice,
        Discount: item.discount ?? 0,
        PreTaxVal: item.quantity * item.unitPrice - (item.discount ?? 0),
        AssAmt: item.quantity * item.unitPrice - (item.discount ?? 0),
        GstRt: isInterState ? (item.igstRate ?? item.taxRate ?? 0) : ((item.cgstRate ?? 0) + (item.sgstRate ?? 0)),
        IgstAmt: isInterState ? (item.igstAmount ?? 0) : 0,
        CgstAmt: isInterState ? 0 : (item.cgstAmount ?? 0),
        SgstAmt: isInterState ? 0 : (item.sgstAmount ?? 0),
        CesRt: 0,
        CesAmt: 0,
        CesNonAdvlAmt: 0,
        StateCesRt: 0,
        StateCesAmt: 0,
        StateCesNonAdvlAmt: 0,
        OthChrg: 0,
        TotItemVal: item.total,
      })),
      ValDtls: {
        AssVal: invoice.subtotal - (invoice.discount ?? 0),
        CgstVal: isInterState ? 0 : (invoice.cgstAmount ?? 0),
        SgstVal: isInterState ? 0 : (invoice.sgstAmount ?? 0),
        IgstVal: isInterState ? (invoice.igstAmount ?? 0) : 0,
        CesVal: 0,
        StCesVal: 0,
        Discount: invoice.discount ?? 0,
        OthChrg: 0,
        RndOffAmt: 0,
        TotInvVal: invoice.total,
        TotInvValFc: 0,
      },
      PayDtls: {
        Nm: party?.name ?? "",
        AccDet: "",
        Mode: "Cash",
        FinInsBr: "",
        PayTerm: invoice.terms ?? "",
        PayInstr: "",
        CrTrn: "",
        DirDr: "",
        CrDay: 0,
        PaidAmt: invoice.paidAmount ?? 0,
        PaymtDue: invoice.balanceDue ?? 0,
      },
      RefDtls: {
        InvRm: invoice.notes ?? "",
        DocPerdDtls: {
          InvStDt: fmtDate(invoice.invoiceDate),
          InvEndDt: invoice.dueDate ? fmtDate(invoice.dueDate) : fmtDate(invoice.invoiceDate),
        },
        PrecDocDtls: [],
        ContrDtls: [],
      },
      EwbDtls: null,
    };

    ok(res, { payload, invoiceNumber: invoice.invoiceNumber, existingIRN: invoice.eInvoiceIRN });
  } catch (err) {
    serverError(res, err);
  }
}

// Save IRN returned from the GSTN portal back to the invoice record
export async function saveIRN(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const invoiceId = String(req.params.id);
    const { irn, ackNo, ackDt } = req.body as { irn: string; ackNo?: string; ackDt?: string };

    if (!irn) { badRequest(res, "irn is required"); return; }

    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: orgId } });
    if (!invoice) { notFound(res, "Invoice not found"); return; }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eInvoiceIRN: irn,
        notes: invoice.notes
          ? `${invoice.notes}\nIRN: ${irn}${ackNo ? ` | ACK: ${ackNo}` : ""}${ackDt ? ` | ${ackDt}` : ""}`
          : `IRN: ${irn}${ackNo ? ` | ACK: ${ackNo}` : ""}${ackDt ? ` | ${ackDt}` : ""}`,
      },
    });

    ok(res, { irn, invoiceId: updated.id });
  } catch (err) {
    serverError(res, err);
  }
}

// List invoices that need e-invoice (SENT/PAID, no IRN yet, this financial year)
export async function listPendingEInvoices(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    // Current financial year start (April 1)
    const now = new Date();
    const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        type: "SALES",
        status: { in: ["SENT", "PAID", "PARTIAL"] },
        eInvoiceIRN: null,
        invoiceDate: { gte: fyStart },
      },
      include: { party: { select: { name: true, gstin: true } } },
      orderBy: { invoiceDate: "desc" },
      take: 100,
    });

    ok(res, { invoices, total: invoices.length });
  } catch (err) {
    serverError(res, err);
  }
}
