// src/modules/auth/auth.routes.ts
import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { registerSchema, loginSchema, changePasswordSchema } from "./auth.schema";

const router = Router();

router.post("/register", validate(registerSchema), authController.register.bind(authController));
router.post("/login", validate(loginSchema), authController.login.bind(authController));
router.post("/logout", authenticate, authController.logout.bind(authController));
router.get("/me", authenticate, authController.getMe.bind(authController));
router.patch(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword.bind(authController)
);

export default router;