import { Router } from "express";
import { submitContactRequest } from "../controllers/contact.controller";

const router = Router();

// Public — no auth required
router.post("/", submitContactRequest);

export default router;
