import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listBatches, createBatch, updateBatch, deleteBatch, getExpiryAlerts } from "../controllers/batch.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",               listBatches);
router.get("/expiry-alerts",  getExpiryAlerts);
router.post("/",              createBatch);
router.patch("/:id",          updateBatch);
router.delete("/:id",         deleteBatch);

export default router;
