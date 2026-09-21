import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  listWarehouses, createWarehouse, updateWarehouse,
  createTransfer, completeTransfer, listTransfers,
} from "../controllers/warehouse.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/transfers", listTransfers);
router.post("/transfers", requirePermission("warehouse:transfer"), createTransfer);
router.patch("/transfers/:id/complete", requirePermission("warehouse:transfer"), completeTransfer);

router.get("/", listWarehouses);
router.post("/", requirePermission("warehouse:create"), createWarehouse);
router.patch("/:id", requirePermission("warehouse:update"), updateWarehouse);

export default router;
