import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  getWhatsAppConfig, saveWhatsAppConfig, disconnectWhatsApp,
  sendMessage, sendTemplate, bulkSend, listMessages,
  verifyWebhook, handleWebhook, getTemplates,
} from "../controllers/whatsapp.controller";

const router = Router();

// ── Webhook (public — Meta calls these) ──────────────────────
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleWebhook);

// ── Protected routes ──────────────────────────────────────────
router.use(authenticate, requireOrgContext);

router.get("/config",      getWhatsAppConfig);
router.post("/config",     saveWhatsAppConfig);
router.delete("/config",   disconnectWhatsApp);
router.get("/templates",   getTemplates);
router.post("/send",       sendMessage);
router.post("/send-template", sendTemplate);
router.post("/bulk-send",  bulkSend);
router.get("/messages",    listMessages);

export default router;
