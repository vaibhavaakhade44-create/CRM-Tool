import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { listSessions, revokeSession, revokeAllOtherSessions } from "../controllers/session.controller";

const router = Router();
router.use(authenticate);

router.get("/",           listSessions);
router.delete("/all",     revokeAllOtherSessions);
router.delete("/:id",     revokeSession);

export default router;
