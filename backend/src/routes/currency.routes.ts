import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listRates, upsertRate, deleteRate, convertAmount } from "../controllers/currency.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",           listRates);
router.get("/convert",    convertAmount);
router.post("/",          upsertRate);
router.delete("/:id",     deleteRate);

export default router;
