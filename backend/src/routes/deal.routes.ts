import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listDeals, getDealStats, createDeal, updateDeal, deleteDeal } from "../controllers/deal.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/stats", getDealStats);
router.get("/",      listDeals);
router.post("/",     createDeal);
router.patch("/:id", updateDeal);
router.delete("/:id", deleteDeal);

export default router;
