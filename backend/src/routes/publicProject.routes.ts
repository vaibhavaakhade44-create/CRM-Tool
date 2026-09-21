import { Router } from "express";
import { getPublicProject } from "../controllers/publicProject.controller";

const router = Router();

// No auth middleware — public read-only
router.get("/project/:token", getPublicProject);

export default router;
