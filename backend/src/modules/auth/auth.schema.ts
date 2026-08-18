// src/modules/auth/auth.schema.ts
import Joi from "joi";

const password = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  .message("Password must have uppercase, lowercase, number, and special character");

// `role` is intentionally NOT accepted: with stripUnknown, a client-supplied
// role is dropped rather than honoured, so nobody can self-register as admin.
// Privileged roles are granted by an admin/hr user.
export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().max(254).required(),
  password: password.required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().max(254).required(),
  password: Joi.string().max(128).required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(128).required(),
  newPassword: password.required().invalid(Joi.ref("currentPassword")).messages({
    "any.invalid": "New password must be different from the current one",
  }),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});
