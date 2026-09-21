import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext, requireRole } from "../middleware/orgContext";
import { getOrgAdminStats, getOrgActivity, getTeamActivity, getAuditLogs, getModuleStats, getAlerts, getChartData, listPendingLeaves, approveLeave } from "../controllers/orgAdmin.controller";

const router = Router();
router.use(authenticate, requireOrgContext, requireRole("ADMIN"));

router.get("/stats",         getOrgAdminStats);
router.get("/activity",      getOrgActivity);
router.get("/team",          getTeamActivity);
router.get("/audit-logs",    getAuditLogs);
router.get("/module-stats",  getModuleStats);
router.get("/alerts",        getAlerts);
router.get("/charts",        getChartData);
// Leave management — admin/management can see ALL pending leaves (including HR staff)
router.get("/leaves",           listPendingLeaves);
router.patch("/leaves/:id",     approveLeave);

export default router;
