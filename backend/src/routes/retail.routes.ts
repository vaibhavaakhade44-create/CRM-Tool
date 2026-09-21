import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listCollections, createCollection,
  listVariants, createVariant, updateVariant,
  openPOSSession, closePOSSession, listPOSSessions,
  createPOSSale, listPOSSales,
} from "../controllers/retail.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/collections", listCollections);
router.post("/collections", createCollection);

router.get("/variants", listVariants);
router.post("/variants", createVariant);
router.patch("/variants/:id", updateVariant);

router.get("/pos/sessions", listPOSSessions);
router.post("/pos/sessions", openPOSSession);
router.patch("/pos/sessions/:id/close", closePOSSession);

router.get("/pos/sales", listPOSSales);
router.post("/pos/sales", createPOSSale);

export default router;
