import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listComments, addComment, deleteComment } from "../controllers/comments.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",     listComments);
router.post("/",    addComment);
router.delete("/:id", deleteComment);

export default router;
