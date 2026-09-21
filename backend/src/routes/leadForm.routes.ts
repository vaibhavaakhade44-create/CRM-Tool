import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listForms, getForm, createForm, updateForm, deleteForm,
  getSubmissions, getPublicForm, submitForm,
} from "../controllers/leadForm.controller";

const router = Router();

// ── Public routes (no auth) ───────────────────────────────────
router.get("/public/:id",    getPublicForm);
router.post("/public/:id",   submitForm);

// ── Protected routes ──────────────────────────────────────────
router.use(authenticate, requireOrgContext);

router.get("/",              listForms);
router.post("/",             createForm);
router.get("/:id",           getForm);
router.patch("/:id",         updateForm);
router.delete("/:id",        deleteForm);
router.get("/:id/submissions", getSubmissions);

export default router;
