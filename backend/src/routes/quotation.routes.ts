import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listQuotations, getQuotationStats, getQuotation, createQuotation, updateQuotationStatus, deleteQuotation } from "../controllers/quotation.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/stats",       getQuotationStats);
router.get("/",            listQuotations);
router.post("/",           createQuotation);
router.get("/:id",         getQuotation);
router.patch("/:id/status", updateQuotationStatus);
router.delete("/:id",      deleteQuotation);

export default router;
