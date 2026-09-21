import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  getAuthUrl, handleCallback, getStatus, disconnect,
  listInbox, getMessage, getThread, sendGmail, trashMessage, listLabels,
} from "../controllers/gmail.controller";

const router = Router();

// Callback is public — Google redirects here after OAuth consent
router.get("/callback", handleCallback);

// All other routes require auth
router.use(authenticate, requireOrgContext);

router.get("/auth-url",         getAuthUrl);
router.get("/status",           getStatus);
router.delete("/disconnect",    disconnect);
router.get("/labels",           listLabels);
router.get("/inbox",            listInbox);
router.get("/message/:id",      getMessage);
router.get("/thread/:id",       getThread);
router.post("/send",            sendGmail);
router.delete("/message/:id",   trashMessage);

export default router;
