import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { generateEInvoicePayload, saveIRN, listPendingEInvoices } from "../controllers/einvoice.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/pending",            listPendingEInvoices);
router.get("/:id/payload",        generateEInvoicePayload);
router.patch("/:id/irn",          saveIRN);

export default router;
