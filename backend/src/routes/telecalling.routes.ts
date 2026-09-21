import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listCallLogs, createCallLog, getCallStats,
  listCallScripts, createCallScript, updateCallScript,
  listDNC, addDNC, removeDNC, checkDNC,
  listDialerCampaigns, createDialerCampaign, updateDialerCampaign,
} from "../controllers/telecalling.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Call logs
router.get("/calls/stats",       getCallStats);
router.get("/calls",             listCallLogs);
router.post("/calls",            createCallLog);

// Scripts
router.get("/scripts",           listCallScripts);
router.post("/scripts",          createCallScript);
router.patch("/scripts/:id",     updateCallScript);

// DNC
router.get("/dnc/check",         checkDNC);
router.get("/dnc",               listDNC);
router.post("/dnc",              addDNC);
router.delete("/dnc/:id",        removeDNC);

// Campaigns
router.get("/campaigns",         listDialerCampaigns);
router.post("/campaigns",        createDialerCampaign);
router.patch("/campaigns/:id",   updateDialerCampaign);

export default router;
