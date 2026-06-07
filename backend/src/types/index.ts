import { Request } from "express";
import { Document, Types } from "mongoose";

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface ITokenPayload {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: ITokenPayload;
}

// ─── User / Auth ─────────────────────────────────────────────────────────────
export type UserRole = "admin" | "hr" | "manager" | "employee";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

// ─── Employee ─────────────────────────────────────────────────────────────────
export type EmploymentStatus = "active" | "on_leave" | "terminated" | "probation";
export type Department =
  | "engineering"
  | "hr"
  | "finance"
  | "marketing"
  | "operations"
  | "sales"
  | "legal";

export interface IPerformanceNote {
  note: string;
  addedBy: Types.ObjectId;
  sentiment?: "positive" | "neutral" | "negative";
  sentimentScore?: number;
  addedAt: Date;
}

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  employeeId: string;
  department: Department;
  designation: string;
  salary: number;
  joiningDate: Date;
  status: EmploymentStatus;
  skills: string[];
  performanceNotes: IPerformanceNote[];
  attritionRisk?: number; // 0–1 probability
  attritionRiskUpdatedAt?: Date;
  manager?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export interface IResumeParseResult {
  name: string;
  email: string;
  phone?: string;
  skills: string[];
  experience: string;
  education: string;
  summary: string;
  suggestedDesignation?: string;
  suggestedDepartment?: string;
}

export interface ISentimentResult {
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  reasoning: string;
}

export interface IAttritionResult {
  risk: number;
  factors: string[];
  recommendation: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface IPaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  department?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

// ─── AppError ─────────────────────────────────────────────────────────────────
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}