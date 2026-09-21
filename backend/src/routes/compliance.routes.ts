import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  getComplianceConfig, updateComplianceConfig,
  logConsent, listConsents,
  exportOrgData, deletePartyData,
} from "../controllers/compliance.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/config",               getComplianceConfig);
router.patch("/config",             updateComplianceConfig);

router.get("/consents",             listConsents);
router.post("/consents",            logConsent);

router.get("/export",               exportOrgData);
router.delete("/party/:partyId",    deletePartyData);

export default router;
