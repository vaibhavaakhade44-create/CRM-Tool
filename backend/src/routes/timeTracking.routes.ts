import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listTimeEntries, createTimeEntry, updateTimeEntry, deleteTimeEntry, getTimeSummary,
  listSLAPolicies, createSLAPolicy, updateSLAPolicy, deleteSLAPolicy,
  listAllocations, createAllocation, updateAllocation, deleteAllocation,
} from "../controllers/timeTracking.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Time entries
router.get("/entries/summary",   getTimeSummary);
router.get("/entries",           listTimeEntries);
router.post("/entries",          createTimeEntry);
router.patch("/entries/:id",     updateTimeEntry);
router.delete("/entries/:id",    deleteTimeEntry);

// SLA policies
router.get("/sla",               listSLAPolicies);
router.post("/sla",              createSLAPolicy);
router.patch("/sla/:id",         updateSLAPolicy);
router.delete("/sla/:id",        deleteSLAPolicy);

// Resource allocation
router.get("/allocations",       listAllocations);
router.post("/allocations",      createAllocation);
router.patch("/allocations/:id", updateAllocation);
router.delete("/allocations/:id", deleteAllocation);

export default router;
