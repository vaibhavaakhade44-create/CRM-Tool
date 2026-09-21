import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { createPaymentLink, verifyPayment } from "../controllers/payment.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.post("/razorpay/create-link", createPaymentLink);
router.post("/razorpay/verify",      verifyPayment);

export default router;
