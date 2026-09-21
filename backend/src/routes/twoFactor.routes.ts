import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { setup2FA, verify2FA, disable2FA, validate2FAToken, get2FAStatus } from "../controllers/twoFactor.controller";

const router = Router();
router.use(authenticate);

router.get("/status",   get2FAStatus);
router.post("/setup",   setup2FA);
router.post("/verify",  verify2FA);
router.post("/disable", disable2FA);
router.post("/validate",validate2FAToken);

export default router;
