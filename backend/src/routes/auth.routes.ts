import { Router } from "express";
import * as controller from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { limits } from "../middleware/rate-limit.js";

export const authRoutes = Router();

authRoutes.get("/session", controller.session);
authRoutes.get("/providers", controller.providers);
authRoutes.post("/register", limits.signup, controller.register);
authRoutes.post("/login", limits.loginIp, limits.login, controller.login);
authRoutes.post("/logout", controller.logout);
authRoutes.get("/verify-email", limits.passwordReset, controller.verifyEmail);
authRoutes.post("/resend-email", limits.authEmail, controller.resendEmail);
authRoutes.post("/forgot-password", limits.authEmail, controller.forgotPassword);
authRoutes.post("/reset-password", limits.passwordReset, controller.resetPassword);

authRoutes.get("/oauth/:provider/start", limits.loginIp, controller.oauthStart);
authRoutes.get("/oauth/:provider/callback", limits.loginIp, controller.oauthCallback);

authRoutes.post("/onboarding", requireAuth, controller.onboarding);
authRoutes.post("/workspace", requireAuth, controller.switchWorkspace);
authRoutes.patch("/profile", requireAuth, controller.updateProfile);
authRoutes.post("/password", requireAuth, limits.passwordReset, controller.changePassword);
authRoutes.get("/sessions", requireAuth, controller.sessionsList);
authRoutes.delete("/sessions/:id", requireAuth, controller.revokeSession);
