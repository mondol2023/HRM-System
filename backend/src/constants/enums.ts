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

/** Mongoose `enum` option wants a mutable array. */
export const asMutable = <T extends readonly string[]>(values: T): string[] => [...values];
