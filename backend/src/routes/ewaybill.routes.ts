import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { generateEWayBillPayload, saveEWayBillNumber, listPendingEWayBills } from "../controllers/ewaybill.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/pending",          listPendingEWayBills);
router.get("/:id/payload",      generateEWayBillPayload);
router.patch("/:id/ewb",        saveEWayBillNumber);

export default router;
