import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  updatePurchaseOrderStatus, deletePurchaseOrder,
} from "../controllers/purchase.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/", listPurchaseOrders);
router.post("/", requirePermission("purchase:create"), createPurchaseOrder);
router.get("/:id", getPurchaseOrder);
// Multi-purpose status endpoint (submit, approve, receive…). Gate at STAFF; a
// dedicated approve-only endpoint should use "purchase:approve" (MANAGER).
router.patch("/:id/status", requirePermission("purchase:update"), updatePurchaseOrderStatus);
router.delete("/:id", requirePermission("purchase:delete"), deletePurchaseOrder);

export default router;
