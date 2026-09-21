import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listProjects, getProject, createProject, updateProject,
  listTasks, createTask, updateTask, addTaskComment,
  getMyProjects, getProjectTeam, upsertProjectMember, removeProjectMember, getMyTeam, getMyTasks,
} from "../controllers/projects.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// PM / TL / Employee specific routes (before /:id to avoid conflicts)
router.get("/my-projects", getMyProjects);
router.get("/my-team",     getMyTeam);
router.get("/my-tasks",    getMyTasks);

router.get("/tasks", listTasks);
router.post("/tasks", createTask);
router.patch("/tasks/:id", updateTask);
router.post("/tasks/:id/comments", addTaskComment);

router.get("/", listProjects);
router.post("/", createProject);
router.get("/:id", getProject);
router.patch("/:id", updateProject);
router.get("/:id/team", getProjectTeam);
router.post("/:id/members", upsertProjectMember);
router.delete("/:projectId/members/:employeeId", removeProjectMember);

export default router;
