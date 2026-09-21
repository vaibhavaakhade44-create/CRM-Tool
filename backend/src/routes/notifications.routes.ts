import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listNotifications, markRead, deleteNotification } from "../controllers/notifications.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",            listNotifications);
router.patch("/mark-read", markRead);
router.delete("/:id",      deleteNotification);

export default router;
