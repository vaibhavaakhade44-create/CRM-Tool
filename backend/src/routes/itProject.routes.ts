import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listProjects, getProject, createProject, updateProject,
  addMember, removeMember, addMilestone, updateMilestone,
  getTeamDashboard, getMyWork, generateShareLink, revokeShareLink,
} from "../controllers/itProject.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",                              listProjects);
router.post("/",                             createProject);
router.get("/team-dashboard",                getTeamDashboard);
router.get("/my-work",                       getMyWork);
router.get("/:id",                           getProject);
router.put("/:id",                           updateProject);
router.post("/:id/members",                  addMember);
router.delete("/:id/members/:memberId",      removeMember);
router.post("/:id/milestones",               addMilestone);
router.patch("/:id/milestones/:msId",        updateMilestone);
router.post("/:id/share",                    generateShareLink);
router.delete("/:id/share",                  revokeShareLink);

export default router;
