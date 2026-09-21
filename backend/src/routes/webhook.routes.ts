import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  listWebhooks, createWebhook, updateWebhook, deleteWebhook,
  rotateSecret, testWebhook, listDeliveries,
} from "../controllers/webhook.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Webhooks can exfiltrate org data to an arbitrary URL — treat as admin config.
router.get("/",                   requirePermission("webhooks:manage"), listWebhooks);
router.post("/",                  requirePermission("webhooks:manage"), createWebhook);
router.put("/:id",                requirePermission("webhooks:manage"), updateWebhook);
router.delete("/:id",             requirePermission("webhooks:manage"), deleteWebhook);
router.post("/:id/rotate-secret", requirePermission("webhooks:manage"), rotateSecret);
router.post("/:id/test",          requirePermission("webhooks:manage"), testWebhook);
router.get("/:id/deliveries",     requirePermission("webhooks:manage"), listDeliveries);

export default router;
