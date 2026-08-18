// src/constants/enums.ts
//
// The single definition of every closed value set in the domain. Mongoose
// schemas, Joi schemas and TypeScript types all derive from these arrays, so
// adding a department is a one-line change instead of a four-file grep.

export const USER_ROLES = ["admin", "hr", "manager", "employee"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DEPARTMENTS = [
  "engineering",
  "hr",
  "finance",
  "marketing",
  "operations",
  "sales",
  "legal",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const EMPLOYMENT_STATUSES = ["active", "on_leave", "terminated", "probation"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const EMPLOYEE_SORT_FIELDS = [
  "joiningDate",
  "salary",
  "attritionRisk",
  "createdAt",
] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

/** Roles that can see any employee record without an ownership check. */
export const PRIVILEGED_ROLES: readonly UserRole[] = ["admin", "hr"];

/** Every action the audit trail knows how to record — add here, not ad-hoc strings. */
export const AUDIT_ACTIONS = [
  "employee.create",
  "employee.update",
  "employee.terminate",
  "employee.note.add",
  "leave.request.create",
  "leave.request.approve",
  "leave.request.reject",
  "leave.request.cancel",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** "monthly" prorates 1/12th of the annual entitlement per month; "fixed" credits the full amount at once (e.g. maternity/paternity). */
export const LEAVE_ACCRUAL_METHODS = ["monthly", "fixed"] as const;
export type LeaveAccrualMethod = (typeof LEAVE_ACCRUAL_METHODS)[number];

export const LEAVE_REQUEST_STATUSES = [
  "pending",
  "manager_approved",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

/** Mongoose `enum` option wants a mutable array. */
export const asMutable = <T extends readonly string[]>(values: T): string[] => [...values];
