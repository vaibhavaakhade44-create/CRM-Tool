import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

// Supported currencies
export const CURRENCIES = [
  { code: "INR", name: "Indian Rupee",       symbol: "₹" },
  { code: "USD", name: "US Dollar",          symbol: "$" },
  { code: "EUR", name: "Euro",               symbol: "€" },
  { code: "GBP", name: "British Pound",      symbol: "£" },
  { code: "AED", name: "UAE Dirham",         symbol: "د.إ" },
  { code: "SGD", name: "Singapore Dollar",   symbol: "S$" },
  { code: "JPY", name: "Japanese Yen",       symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan",       symbol: "¥" },
  { code: "AUD", name: "Australian Dollar",  symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar",    symbol: "C$" },
  { code: "CHF", name: "Swiss Franc",        symbol: "CHF" },
  { code: "SAR", name: "Saudi Riyal",        symbol: "﷼" },
  { code: "MYR", name: "Malaysian Ringgit",  symbol: "RM" },
  { code: "THB", name: "Thai Baht",          symbol: "฿" },
];

// List all rates for this org (latest per pair)
export async function listRates(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const rates = await (prisma as any).exchangeRate.findMany({
      where: { organizationId: orgId },
      orderBy: [{ fromCurrency: "asc" }, { effectiveDate: "desc" }],
    });
    ok(res, { rates, currencies: CURRENCIES });
  } catch (err) {
    serverError(res, err);
  }
}

// Upsert a rate (add or replace for this pair + date)
export async function upsertRate(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { fromCurrency, toCurrency, rate, effectiveDate } = req.body as {
      fromCurrency: string; toCurrency: string; rate: number; effectiveDate?: string;
    };

    if (!fromCurrency || !toCurrency || rate == null) {
      badRequest(res, "fromCurrency, toCurrency and rate are required");
      return;
    }
    if (fromCurrency === toCurrency) {
      badRequest(res, "fromCurrency and toCurrency must differ");
      return;
    }

    const entry = await (prisma as any).exchangeRate.create({
      data: {
        organizationId: orgId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate: Number(rate),
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        source: "MANUAL",
      },
    });

    created(res, entry);
  } catch (err) {
    serverError(res, err);
  }
}

// Delete a rate entry
export async function deleteRate(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = String(req.params.id);

    const entry = await (prisma as any).exchangeRate.findFirst({ where: { id, organizationId: orgId } });
    if (!entry) { notFound(res, "Rate not found"); return; }

    await (prisma as any).exchangeRate.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}

// Convert amount: GET /api/currency/convert?from=USD&to=INR&amount=100
export async function convertAmount(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { from, to, amount } = req.query as { from: string; to: string; amount: string };

    if (!from || !to || !amount) { badRequest(res, "from, to and amount required"); return; }
    if (from.toUpperCase() === to.toUpperCase()) {
      ok(res, { from, to, rate: 1, amount: Number(amount), converted: Number(amount) });
      return;
    }

    // Get latest rate for this pair
    const rate = await (prisma as any).exchangeRate.findFirst({
      where: { organizationId: orgId, fromCurrency: from.toUpperCase(), toCurrency: to.toUpperCase() },
      orderBy: { effectiveDate: "desc" },
    });

    if (!rate) {
      // Try inverse
      const inverse = await (prisma as any).exchangeRate.findFirst({
        where: { organizationId: orgId, fromCurrency: to.toUpperCase(), toCurrency: from.toUpperCase() },
        orderBy: { effectiveDate: "desc" },
      });
      if (inverse) {
        const r = 1 / inverse.rate;
        ok(res, { from, to, rate: r, amount: Number(amount), converted: Number(amount) * r });
        return;
      }
      ok(res, { from, to, rate: null, amount: Number(amount), converted: null, error: "No rate found for this pair" });
      return;
    }

    ok(res, { from, to, rate: rate.rate, amount: Number(amount), converted: Number(amount) * rate.rate, effectiveDate: rate.effectiveDate });
  } catch (err) {
    serverError(res, err);
  }
}
