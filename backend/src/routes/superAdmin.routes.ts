import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireSuperAdmin } from "../middleware/superAdmin";
import {
  getSuperAdminStats, listAllOrganizations, getOrganizationDetail,
  updateOrganization, listAllUsers, createUser, toggleUserActive, makeSuperAdmin,
  adminDisable2FA, listModuleRequests, resolveModuleRequest,
} from "../controllers/superAdmin.controller";
import { listDemoRequests, updateDemoRequest } from "../controllers/contact.controller";

const router = Router();
router.use(authenticate, requireSuperAdmin);

router.get("/stats",         getSuperAdminStats);
router.get("/organizations", listAllOrganizations);
router.get("/organizations/:id", getOrganizationDetail);
router.patch("/organizations/:id", updateOrganization);
router.get("/users",         listAllUsers);
router.post("/users",        createUser);
router.patch("/users/:id/toggle-active", toggleUserActive);
router.patch("/users/:id/super-admin",   makeSuperAdmin);
router.post("/users/:id/disable-2fa",    adminDisable2FA);

// Demo / access requests from landing page
router.get("/demo-requests",         listDemoRequests);
router.patch("/demo-requests/:id",   updateDemoRequest);

// Org module requests — approve/deny an org gaining a new module
router.get("/module-requests",       listModuleRequests);
router.patch("/module-requests/:id", resolveModuleRequest);

export default router;
