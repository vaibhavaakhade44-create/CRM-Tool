import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  upload,
  uploadDocuments,
  listDocuments,
  getDocumentStats,
  downloadDocument,
  deleteDocument,
} from "../controllers/document.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/stats",                getDocumentStats);
router.get("/",                     listDocuments);
router.post("/", requirePermission("documents:create"), upload.array("files", 10), uploadDocuments);
router.get("/:id/download",         downloadDocument);
router.delete("/:id", requirePermission("documents:delete"), deleteDocument);

export default router;
