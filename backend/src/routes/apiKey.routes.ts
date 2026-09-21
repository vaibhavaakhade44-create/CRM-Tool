import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import { createApiKey, listApiKeys, revokeApiKey, getScopes } from "../controllers/apiKey.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/scopes",  getScopes);
router.get("/",        requirePermission("apikeys:manage"), listApiKeys);
router.post("/",       requirePermission("apikeys:manage"), createApiKey);
router.delete("/:id",  requirePermission("apikeys:manage"), revokeApiKey);

export default router;
