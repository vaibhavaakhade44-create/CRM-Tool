import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import { getBranding, updateBranding } from "../controllers/branding.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",   getBranding);
router.patch("/", requirePermission("branding:manage"), updateBranding);

export default router;
