import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext, requireRole } from "../middleware/orgContext";
import { getPendingApprovals, approvePO, rejectPO, approveExpense, rejectExpense } from "../controllers/approval.controller";

const router = Router();
router.use(authenticate, requireOrgContext, requireRole("MANAGER"));

router.get("/pending",              getPendingApprovals);
router.post("/po/:id/approve",      approvePO);
router.post("/po/:id/reject",       rejectPO);
router.post("/expense/:id/approve", approveExpense);
router.post("/expense/:id/reject",  rejectExpense);

export default router;
