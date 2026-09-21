import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { findDuplicateParties, mergeParties, findDuplicateProducts } from "../controllers/duplicate.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/parties",          findDuplicateParties);
router.post("/parties/merge",   mergeParties);
router.get("/products",         findDuplicateProducts);

export default router;
