import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { getPortalLink, viewInvoiceByToken, portalPaymentIntent } from "../controllers/portal.controller";

const router = Router();

// Public routes — no auth
router.get("/invoice/:token",         viewInvoiceByToken);
router.post("/invoice/:token/pay",    portalPaymentIntent);

// Authenticated: generate share link for an invoice
router.get("/link/:id", authenticate, requireOrgContext, getPortalLink);

export default router;
