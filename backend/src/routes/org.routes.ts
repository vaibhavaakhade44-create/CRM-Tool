import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  createOrganization,
  getMyOrganizations,
  getOrganization,
  updateOrganization,
  inviteMember,
  getInviteInfo,
  acceptInvite,
  registerViaInvite,
  listPendingInvites,
  resendInvite,
  cancelInvite,
  listMembers,
  updateMemberRole,
  removeMember,
  requestOrgModule,
  listOrgModuleRequests,
  createOrgEmployee,
  listOrgDirectory,
} from "../controllers/org.controller";

const router = Router();

// Public — no auth required
router.get("/invite/info", getInviteInfo);
router.post("/invite/register", registerViaInvite);

// All routes below require authentication
router.use(authenticate);

// No org context needed
router.post("/", createOrganization);
router.get("/", getMyOrganizations);
router.post("/invite/accept", acceptInvite);

// Org context required (x-organization-id header)
router.get("/current", requireOrgContext, getOrganization);
router.patch("/current", requireOrgContext, updateOrganization);
router.get("/current/members", requireOrgContext, listMembers);
router.post("/current/members/invite", requireOrgContext, inviteMember);
router.get("/current/members/invites", requireOrgContext, listPendingInvites);
router.post("/current/members/invites/:inviteId/resend", requireOrgContext, resendInvite);
router.delete("/current/members/invites/:inviteId", requireOrgContext, cancelInvite);
router.patch("/current/members/:memberId/role", requireOrgContext, updateMemberRole);
router.delete("/current/members/:memberId", requireOrgContext, removeMember);
router.post("/current/module-requests", requireOrgContext, requestOrgModule);
router.get("/current/module-requests", requireOrgContext, listOrgModuleRequests);
router.post("/current/employees", requireOrgContext, createOrgEmployee);
router.get("/current/directory", requireOrgContext, listOrgDirectory);

export default router;
