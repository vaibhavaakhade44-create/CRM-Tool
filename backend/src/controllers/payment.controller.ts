import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, badRequest, notFound, serverError } from "../utils/response";
import Razorpay from "razorpay";
import crypto from "crypto";

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ── POST /api/payments/razorpay/create-link ───────────────────
// Creates a Razorpay payment link for an invoice
export async function createPaymentLink(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { invoiceId } = req.body as { invoiceId: string };
    if (!invoiceId) { badRequest(res, "invoiceId required"); return; }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: req.organizationId! },
      include: { party: true, organization: true },
    });
    if (!invoice) { notFound(res, "Invoice not found"); return; }
    if (invoice.balanceDue <= 0) { badRequest(res, "Invoice is already fully paid"); return; }

    const rz = getRazorpay();
    const amountPaise = Math.round(invoice.balanceDue * 100);

    const link = await (rz as any).paymentLink.create({
      amount: amountPaise,
      currency: "INR",
      accept_partial: false,
      description: `Payment for Invoice ${invoice.invoiceNumber}`,
      customer: {
        name: invoice.party?.name ?? "Customer",
        email: invoice.party?.email ?? undefined,
        contact: invoice.party?.phone ?? undefined,
      },
      notify: { sms: !!(invoice.party?.phone), email: !!(invoice.party?.email) },
      reminder_enable: true,
      notes: {
        invoice_number: invoice.invoiceNumber,
        organization: invoice.organization.name,
      },
      callback_url: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/accounts`,
      callback_method: "get",
    });

    // Store the payment link ID on the invoice for tracking
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { notes: invoice.notes ? `${invoice.notes}\nRazorpay Link: ${link.short_url}` : `Razorpay Link: ${link.short_url}` },
    });

    ok(res, { paymentUrl: link.short_url, linkId: link.id, amount: invoice.balanceDue });
  } catch (e: any) {
    if (e.message === "Razorpay credentials not configured") {
      badRequest(res, "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your environment.");
      return;
    }
    serverError(res, e);
  }
}

// ── POST /api/payments/razorpay/verify ───────────────────────
// Verifies a Razorpay payment signature and marks invoice paid
export async function verifyPayment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { razorpay_payment_id, razorpay_payment_link_id, razorpay_payment_link_reference_id,
      razorpay_payment_link_status, razorpay_signature, invoiceId } = req.body as Record<string, string>;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) { badRequest(res, "Razorpay not configured"); return; }

    // Verify signature
    const payload = `${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${razorpay_payment_link_status}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
    if (expected !== razorpay_signature) { badRequest(res, "Invalid payment signature"); return; }

    if (!invoiceId) { ok(res, { verified: true }); return; }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: req.organizationId! },
    });
    if (!invoice) { notFound(res, "Invoice not found"); return; }

    // Record payment
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          organizationId: req.organizationId!,
          invoiceId,
          method: "UPI",
          amount: invoice.balanceDue,
          currency: "INR",
          referenceNumber: razorpay_payment_id,
          paymentDate: new Date(),
          notes: `Razorpay payment ${razorpay_payment_id}`,
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: invoice.paidAmount + invoice.balanceDue,
          balanceDue: 0,
          status: "PAID",
        },
      }),
    ]);

    ok(res, { verified: true, message: "Payment recorded successfully" });
  } catch (e) {
    serverError(res, e);
  }
}
