// src/modules/employee/employee.schema.ts
import Joi from "joi";

export const createEmployeeSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  employeeId: Joi.string().uppercase().alphanum().min(3).max(20).required(),
  department: Joi.string()
    .valid("engineering", "hr", "finance", "marketing", "operations", "sales", "legal")
    .required(),
  designation: Joi.string().trim().min(2).max(100).required(),
  salary: Joi.number().positive().required(),
  joiningDate: Joi.date().iso().required(),
  status: Joi.string()
    .valid("active", "on_leave", "terminated", "probation")
    .default("active"),
  skills: Joi.array().items(Joi.string().trim()).default([]),
  manager: Joi.string().hex().length(24).optional(),
});

export const updateEmployeeSchema = Joi.object({
  department: Joi.string().valid(
    "engineering", "hr", "finance", "marketing", "operations", "sales", "legal"
  ),
  designation: Joi.string().trim().min(2).max(100),
  salary: Joi.number().positive(),
  status: Joi.string().valid("active", "on_leave", "terminated", "probation"),
  skills: Joi.array().items(Joi.string().trim()),
  manager: Joi.string().hex().length(24).allow(null),
}).min(1);

export const addPerformanceNoteSchema = Joi.object({
  note: Joi.string().trim().min(10).max(2000).required(),
});

export const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).optional(),
  department: Joi.string().optional(),
  status: Joi.string().optional(),
  sortBy: Joi.string().valid("joiningDate", "salary", "attritionRisk", "createdAt").default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});