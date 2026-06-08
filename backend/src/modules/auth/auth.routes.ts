// src/modules/auth/auth.routes.ts
import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authLimiter } from "../../middleware/rateLimit.middleware";
import { registerSchema, loginSchema, changePasswordSchema } from "./auth.schema";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), authController.register.bind(authController));
router.post("/login", authLimiter, validate(loginSchema), authController.login.bind(authController));
router.post("/logout", authenticate, authController.logout.bind(authController));
router.get("/me", authenticate, authController.getMe.bind(authController));
router.patch(
  "/change-password",
  authenticate,
  authLimiter,
  validate(changePasswordSchema),
  authController.changePassword.bind(authController)
);

export default router;