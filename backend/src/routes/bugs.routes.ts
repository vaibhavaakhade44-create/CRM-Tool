import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listBugs, getBug, createBug, updateBug, deleteBug,
  addBugComment, getBugStats,
} from "../controllers/bugs.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/stats",         getBugStats);
router.get("/",              listBugs);
router.post("/",             createBug);
router.get("/:id",           getBug);
router.patch("/:id",         updateBug);
router.delete("/:id",        deleteBug);
router.post("/:id/comments", addBugComment);

export default router;
