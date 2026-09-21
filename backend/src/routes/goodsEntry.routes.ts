import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import { listGoodsEntries, createGoodsEntry, updateGoodsEntry, deleteGoodsEntry } from "../controllers/goodsEntry.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",        listGoodsEntries);
router.post("/",       requirePermission("warehouse:create"), createGoodsEntry);
router.patch("/:id",   requirePermission("warehouse:update"), updateGoodsEntry);
router.delete("/:id",  requirePermission("warehouse:delete"), deleteGoodsEntry);

export default router;
