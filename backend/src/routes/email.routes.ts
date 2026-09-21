import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listEmails, sendEmail, getEmailStats, deleteEmail,
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
} from "../controllers/email.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/stats",        getEmailStats);
router.get("/",             listEmails);
router.post("/send",        sendEmail);
router.delete("/:id",       deleteEmail);

router.get("/templates",          listTemplates);
router.post("/templates",         createTemplate);
router.put("/templates/:id",      updateTemplate);
router.delete("/templates/:id",   deleteTemplate);

export default router;
