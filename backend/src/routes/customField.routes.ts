import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import { listFields, createField, updateField, deleteField, getValues, saveValues } from "../controllers/customField.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Defining custom fields is org configuration; setting values on a record is
// ordinary data entry.
router.get("/",             listFields);
router.post("/",            requirePermission("customfields:manage"), createField);
router.patch("/:id",        requirePermission("customfields:manage"), updateField);
router.delete("/:id",       requirePermission("customfields:manage"), deleteField);

router.get("/values",       getValues);
router.post("/values",      saveValues);

export default router;
