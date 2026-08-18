// src/modules/auth/auth.routes.ts
import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authLimiter } from "../../middleware/rateLimit.middleware";
import { asyncHandler } from "../../core/http/asyncHandler";
import { changePasswordSchema, loginSchema, refreshSchema, registerSchema } from "./auth.schema";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post("/refresh", authLimiter, validate(refreshSchema), asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));

router.get("/me", authenticate, asyncHandler(authController.getMe));
router.patch(
  "/change-password",
  authenticate,
  authLimiter,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

export default router;
