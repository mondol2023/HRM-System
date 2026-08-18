// src/modules/leave/leave.schema.ts
import Joi from "joi";
import { LEAVE_ACCRUAL_METHODS, LEAVE_REQUEST_STATUSES } from "../../constants/enums";

const objectId = Joi.string().hex().length(24);

export const idParamSchema = Joi.object({
  id: objectId.required(),
});

// ─── Leave types (admin/hr policy config) ─────────────────────────────────────
export const createLeaveTypeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string().trim().uppercase().alphanum().min(2).max(20).required(),
  accrualMethod: Joi.string()
    .valid(...LEAVE_ACCRUAL_METHODS)
    .required(),
  defaultAnnualDays: Joi.number().min(0).max(365).required(),
  paid: Joi.boolean().required(),
  tracksBalance: Joi.boolean().default(true),
  allowNegativeBalance: Joi.boolean().default(false),
  requiresHRApproval: Joi.boolean().default(false),
  active: Joi.boolean().default(true),
});

export const updateLeaveTypeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  accrualMethod: Joi.string().valid(...LEAVE_ACCRUAL_METHODS),
  defaultAnnualDays: Joi.number().min(0).max(365),
  paid: Joi.boolean(),
  tracksBalance: Joi.boolean(),
  allowNegativeBalance: Joi.boolean(),
  requiresHRApproval: Joi.boolean(),
  active: Joi.boolean(),
}).min(1);

// ─── Leave requests ─────────────────────────────────────────────────────────
export const createLeaveRequestSchema = Joi.object({
  leaveType: objectId.required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).required(),
  reason: Joi.string().trim().min(5).max(500).required(),
});

export const decideLeaveRequestSchema = Joi.object({
  decision: Joi.string().valid("approve", "reject").required(),
  // A rejection without a stated reason isn't useful to the employee — require it.
  comment: Joi.string().trim().max(500).when("decision", { is: "reject", then: Joi.required() }),
});

export const listLeaveRequestSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...LEAVE_REQUEST_STATUSES),
  employee: objectId,
  leaveType: objectId,
});
