import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listAccounts, disconnectAccount, setPrimary,
  gmailAuthUrl, gmailCallback,
  outlookAuthUrl, outlookCallback,
  connectImap, getImapPresets,
  getInbox, getMessage, sendEmail,
  listFolders, trashMessage,
} from "../controllers/emailAccount.controller";

const router = Router();

// OAuth callbacks are public (browser redirects here after consent)
router.get("/gmail/callback",   gmailCallback);
router.get("/outlook/callback", outlookCallback);

// Everything else requires auth
router.use(authenticate);

// Account management
router.get("/",                       listAccounts);
router.delete("/:id",                 disconnectAccount);
router.patch("/:id/primary",          setPrimary);

// Provider connection
router.get("/gmail/auth-url",         gmailAuthUrl);
router.get("/outlook/auth-url",       outlookAuthUrl);
router.post("/imap",                  connectImap);
router.get("/imap/presets",           getImapPresets);

// Per-account mail operations
router.get("/:accountId/inbox",        getInbox);
router.get("/:accountId/folders",      listFolders);
router.get("/:accountId/message/:messageId", getMessage);
router.post("/:accountId/send",        sendEmail);
router.delete("/:accountId/message/:messageId", trashMessage);

export default router;
