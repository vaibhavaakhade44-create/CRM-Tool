import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  listSalesOrders, getSalesOrder, createSalesOrder, updateSalesOrderStatus,
  listShipments, createShipment, updateShipmentStatus,
} from "../controllers/sales.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/shipments", listShipments);
router.post("/shipments", requirePermission("sales:create"), createShipment);
router.patch("/shipments/:id/status", requirePermission("sales:update"), updateShipmentStatus);

router.get("/", listSalesOrders);
router.post("/", requirePermission("sales:create"), createSalesOrder);
router.get("/:id", getSalesOrder);
router.patch("/:id/status", requirePermission("sales:update"), updateSalesOrderStatus);

export default router;
