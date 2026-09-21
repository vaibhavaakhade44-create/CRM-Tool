import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  getMyModuleAccess, requestModuleAccess,
  listAccessRequests, resolveAccessRequest,
  getTeamModuleAccess, grantModuleAccess, revokeModuleAccess,
} from "../controllers/accessControl.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/my-access",        getMyModuleAccess);
router.post("/request",         requestModuleAccess);
router.get("/requests",         listAccessRequests);
router.patch("/requests/:id",   resolveAccessRequest);
router.get("/team",             getTeamModuleAccess);
router.post("/grant",           grantModuleAccess);
router.post("/revoke",          revokeModuleAccess);

export default router;
