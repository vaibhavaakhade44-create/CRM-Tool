import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  listInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice,
  addPayment, listPayments, deletePayment, getFinanceSummary,
  listRecurringInvoices, createRecurringInvoice, updateRecurringInvoice, deleteRecurringInvoice,
} from "../controllers/finance.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/summary", getFinanceSummary);
router.get("/payments", listPayments);
router.post("/payments", requirePermission("finance:create"), addPayment);
router.delete("/payments/:id", requirePermission("finance:delete"), deletePayment);

router.get("/", listInvoices);
router.post("/", requirePermission("finance:create"), createInvoice);
router.get("/:id", getInvoice);
router.patch("/:id", requirePermission("finance:update"), updateInvoice);
router.delete("/:id", requirePermission("finance:delete"), deleteInvoice);

// Recurring invoices
router.get("/recurring/list", listRecurringInvoices);
router.post("/recurring", requirePermission("finance:create"), createRecurringInvoice);
router.patch("/recurring/:id", requirePermission("finance:update"), updateRecurringInvoice);
router.delete("/recurring/:id", requirePermission("finance:delete"), deleteRecurringInvoice);

export default router;
