// src/types/index.ts
import type { Request } from "express";
import type { Document, Types } from "mongoose";
import type { Department, EmploymentStatus, Sentiment, UserRole } from "../constants/enums";

export type { Department, EmploymentStatus, Sentiment, UserRole };

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface ITokenPayload {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: ITokenPayload;
}

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

// ─── Employee ────────────────────────────────────────────────────────────────
export interface IPerformanceNote {
  _id: Types.ObjectId;
  note: string;
  addedBy: Types.ObjectId;
  sentiment?: Sentiment;
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
  attritionRisk?: number;
  attritionRiskUpdatedAt?: Date;
  manager?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── AI ──────────────────────────────────────────────────────────────────────
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
  sentiment: Sentiment;
  score: number;
  reasoning: string;
}

export interface IAttritionResult {
  risk: number;
  factors: string[];
  recommendation: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────
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

export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}
