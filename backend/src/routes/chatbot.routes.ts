import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { chat } from "../controllers/chatbot.controller";

const router = Router();
router.use(authenticate);
router.post("/chat", chat);

export default router;
