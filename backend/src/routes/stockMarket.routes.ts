import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listAdvisoryPlans, createAdvisoryPlan, updateAdvisoryPlan,
  listSubscriptions, createSubscription, updateSubscription,
  listTradeCalls, createTradeCall, updateTradeCall,
  listResearchReports, createResearchReport,
  listKYCRecords, upsertKYCRecord, verifyKYC,
  listMarketAlerts, createMarketAlert, deleteMarketAlert,
} from "../controllers/stockMarket.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Advisory plans
router.get("/plans",             listAdvisoryPlans);
router.post("/plans",            createAdvisoryPlan);
router.patch("/plans/:id",       updateAdvisoryPlan);

// Subscriptions
router.get("/subscriptions",     listSubscriptions);
router.post("/subscriptions",    createSubscription);
router.patch("/subscriptions/:id", updateSubscription);

// Trade calls
router.get("/trade-calls",       listTradeCalls);
router.post("/trade-calls",      createTradeCall);
router.patch("/trade-calls/:id", updateTradeCall);

// Research reports
router.get("/research",          listResearchReports);
router.post("/research",         createResearchReport);

// KYC
router.get("/kyc",               listKYCRecords);
router.post("/kyc",              upsertKYCRecord);
router.patch("/kyc/:id/verify",  verifyKYC);

// Market alerts
router.get("/alerts",            listMarketAlerts);
router.post("/alerts",           createMarketAlert);
router.delete("/alerts/:id",     deleteMarketAlert);

export default router;
