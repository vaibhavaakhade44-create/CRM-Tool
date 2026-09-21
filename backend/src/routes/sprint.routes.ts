import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listSprints, getSprintBoard, createSprint, updateSprint,
  assignTaskToSprint, logTime, getTimeLogs,
} from "../controllers/sprint.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",               listSprints);
router.post("/",              createSprint);
router.get("/time-logs",      getTimeLogs);
router.post("/log-time",      logTime);
router.get("/:id/board",      getSprintBoard);
router.put("/:id",            updateSprint);
router.post("/:id/tasks",     assignTaskToSprint);

export default router;
