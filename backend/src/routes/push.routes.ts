import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { getPushPublicKey, subscribePush, unsubscribePush } from "../controllers/push.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/public-key", getPushPublicKey);
router.post("/subscribe", subscribePush);
router.post("/unsubscribe", unsubscribePush);

export default router;
