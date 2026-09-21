import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listPermissions, setPermission, deletePermission,
  listIpAllowlist, addIpAllowlist, removeIpAllowlist,
  getSecurityOverview,
} from "../controllers/security.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Overview
router.get("/overview",          getSecurityOverview);

// Granular permissions
router.get("/permissions",       listPermissions);
router.post("/permissions",      setPermission);
router.delete("/permissions/:id", deletePermission);

// IP allowlist
router.get("/ip-allowlist",      listIpAllowlist);
router.post("/ip-allowlist",     addIpAllowlist);
router.delete("/ip-allowlist/:id", removeIpAllowlist);

export default router;
