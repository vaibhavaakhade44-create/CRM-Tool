import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, notFound, badRequest, serverError } from "../utils/response";
import crypto from "crypto";

// ── Internal: generate/get public token for an invoice ────────

export async function getPortalLink(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const invoiceId = String(req.params.id);

    const invoice = await (prisma.invoice as any).findFirst({ where: { id: invoiceId, organizationId: orgId } });
    if (!invoice) { notFound(res, "Invoice not found"); return; }

    let token = invoice.publicToken as string | null;
    if (!token) {
      token = crypto.randomBytes(24).toString("hex");
      await (prisma.invoice as any).update({ where: { id: invoiceId }, data: { publicToken: token } });
    }

    const baseUrl = process.env.FRONTEND_URL?.split(",")[0] ?? "http://localhost:5173";
    ok(res, { url: `${baseUrl}/portal/invoice/${token}`, token });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Public: view invoice by token (no auth required) ──────────

export async function viewInvoiceByToken(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;

    const invoice = await (prisma.invoice as any).findUnique({
      where: { publicToken: token },
      include: {
        party: { select: { name: true, displayName: true, email: true, phone: true, mobile: true, address: true, city: true, state: true, pincode: true, gstin: true } },
        items: true,
        organization: { select: { name: true, email: true, phone: true, address: true, city: true, state: true, pincode: true, taxId: true, logo: true } },
      },
    });

    if (!invoice) { notFound(res, "Invoice not found or link has expired"); return; }

    // Strip internal fields before returning to public
    const { publicToken: _t, ...safe } = invoice as any;
    ok(res, safe);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Public: record payment intent (customer clicks Pay Now) ───

export async function portalPaymentIntent(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;

    const invoice = await (prisma.invoice as any).findUnique({ where: { publicToken: token } });
    if (!invoice) { notFound(res, "Invoice not found"); return; }
    if (invoice.balanceDue <= 0) { badRequest(res, "No balance due"); return; }

    // If Razorpay is configured, create a payment link
    const KEY_ID     = process.env.RAZORPAY_KEY_ID;
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (KEY_ID && KEY_SECRET) {
      const Razorpay = (await import("razorpay")).default;
      const rz = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
      const link = await (rz as any).paymentLink.create({
        amount: Math.round(invoice.balanceDue * 100),
        currency: "INR",
        description: `Invoice ${invoice.invoiceNumber}`,
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
      });
      ok(res, { paymentUrl: link.short_url });
    } else {
      // Fallback: just return the balance info (manual payment)
      ok(res, { paymentUrl: null, balanceDue: invoice.balanceDue, invoiceNumber: invoice.invoiceNumber });
    }
  } catch (err) {
    serverError(res, err);
  }
}
