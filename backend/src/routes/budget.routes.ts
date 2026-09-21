import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import { listBudgets, createBudget, updateBudget, deleteBudget, updateBudgetItem, getBudgetSummary } from "../controllers/budget.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",                  listBudgets);
router.get("/summary",           getBudgetSummary);
router.post("/",                 requirePermission("budget:write"), createBudget);
router.patch("/:id",             requirePermission("budget:write"), updateBudget);
router.delete("/:id",            requirePermission("budget:delete"), deleteBudget);
router.patch("/items/:itemId",   requirePermission("budget:write"), updateBudgetItem);

export default router;
