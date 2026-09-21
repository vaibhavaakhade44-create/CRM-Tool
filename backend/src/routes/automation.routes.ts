import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import { listRules, createRule, updateRule, deleteRule, toggleRule } from "../controllers/automation.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",             listRules);
router.post("/",            requirePermission("automation:manage"), createRule);
router.patch("/:id",        requirePermission("automation:manage"), updateRule);
router.patch("/:id/toggle", requirePermission("automation:manage"), toggleRule);
router.delete("/:id",       requirePermission("automation:manage"), deleteRule);

export default router;
