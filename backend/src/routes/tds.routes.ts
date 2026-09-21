import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listTDS, getTDSSummary, createTDS, updateTDS, deleteTDS } from "../controllers/tds.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",         listTDS);
router.get("/summary",  getTDSSummary);
router.post("/",        createTDS);
router.patch("/:id",    updateTDS);
router.delete("/:id",   deleteTDS);

export default router;
