// src/modules/auth/auth.schema.ts
import Joi from "joi";

// Public self-registration. `role` is intentionally NOT accepted here —
// letting clients pick their own role would allow anyone to self-register
// as "admin". New users always land as "employee"; privileged roles are
// granted later by an admin/hr user (see roadmap: admin user management).
export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .message(
      "Password must have uppercase, lowercase, number, and special character"
    )
    .required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required(),
});