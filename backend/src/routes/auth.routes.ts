import { Router } from "express";
import {
  register, verifyEmail, login, refreshToken, logout, getMe,
  forgotPassword, resetPassword, claimSuperAdmin,
  changePassword, unlockAccount, googleLogin, verifyPhone2FA, verify2FALogin,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { requireSuperAdmin } from "../middleware/superAdmin";

const router = Router();

router.post("/register",        register);
router.get("/verify-email",     verifyEmail);
router.post("/login",           login);
router.post("/refresh",         refreshToken);
router.post("/logout",          logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);
router.get("/me",               authenticate, getMe);
router.post("/change-password", authenticate, changePassword);
router.post("/claim-super-admin", authenticate, claimSuperAdmin);
router.post("/unlock/:userId",  authenticate, requireSuperAdmin, unlockAccount);
router.post("/google-login",    googleLogin);
router.post("/verify-phone-2fa", verifyPhone2FA);
router.post("/verify-2fa-login", verify2FALogin);

export default router;
