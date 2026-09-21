import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  listTradeDocuments, getTradeDocument, createTradeDocument,
  updateTradeDocument, updateDocumentStatus, deleteTradeDocument, getTradeSummary,
} from "../controllers/trade.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/summary", getTradeSummary);

router.get("/", listTradeDocuments);
router.post("/", requirePermission("sales:create"), createTradeDocument);
router.get("/:id", getTradeDocument);
router.patch("/:id", requirePermission("sales:update"), updateTradeDocument);
router.patch("/:id/status", requirePermission("sales:update"), updateDocumentStatus);
router.delete("/:id", requirePermission("sales:delete"), deleteTradeDocument);

export default router;
