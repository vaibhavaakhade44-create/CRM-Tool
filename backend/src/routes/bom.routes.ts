import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listBOMs, createBOM, deleteBOM, listWorkOrders, createWorkOrder, updateWorkOrderStatus } from "../controllers/bom.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// BOMs
router.get("/",                          listBOMs);
router.post("/",                         createBOM);
router.delete("/:id",                    deleteBOM);

// Work Orders
router.get("/work-orders",               listWorkOrders);
router.post("/work-orders",              createWorkOrder);
router.patch("/work-orders/:id/status",  updateWorkOrderStatus);

export default router;
