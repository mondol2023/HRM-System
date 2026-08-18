// src/modules/employee/employee.schema.ts
import Joi from "joi";
import {
  DEPARTMENTS,
  EMPLOYEE_SORT_FIELDS,
  EMPLOYMENT_STATUSES,
  asMutable,
} from "../../constants/enums";

const objectId = Joi.string().hex().length(24);
const department = Joi.string().valid(...DEPARTMENTS);
const status = Joi.string().valid(...EMPLOYMENT_STATUSES);

export const createEmployeeSchema = Joi.object({
  userId: objectId.required(),
  employeeId: Joi.string().uppercase().alphanum().min(3).max(20).required(),
  department: department.required(),
  designation: Joi.string().trim().min(2).max(100).required(),
  salary: Joi.number().positive().max(1e9).required(),
  joiningDate: Joi.date().iso().required(),
  status: status.default("active"),
  skills: Joi.array().items(Joi.string().trim().max(50)).max(50).default([]),
  manager: objectId.optional(),
});

export const updateEmployeeSchema = Joi.object({
  department,
  designation: Joi.string().trim().min(2).max(100),
  salary: Joi.number().positive().max(1e9),
  status,
  skills: Joi.array().items(Joi.string().trim().max(50)).max(50),
  manager: objectId.allow(null),
}).min(1);

export const addPerformanceNoteSchema = Joi.object({
  note: Joi.string().trim().min(10).max(2000).required(),
});

export const idParamSchema = Joi.object({
  id: objectId.required(),
});

export const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  // Capped: an unbounded limit is a trivial memory/CPU amplifier.
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).optional(),
  department,
  status,
  sortBy: Joi.string()
    .valid(...asMutable(EMPLOYEE_SORT_FIELDS))
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});
