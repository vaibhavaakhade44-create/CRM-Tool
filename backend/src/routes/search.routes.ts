import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { globalSearch } from "../controllers/search.controller";

const router = Router();
router.use(authenticate, requireOrgContext);
router.get("/", globalSearch);

export default router;
