import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { getGSTR1, getGSTR3B, getITCLedger, getAnnualSummary } from "../controllers/gst.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/gstr1",          getGSTR1);
router.get("/gstr3b",         getGSTR3B);
router.get("/itc-ledger",     getITCLedger);
router.get("/annual-summary", getAnnualSummary);

export default router;
