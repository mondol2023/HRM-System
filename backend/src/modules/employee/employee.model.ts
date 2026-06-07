// src/modules/employee/employee.model.ts
import mongoose, { Schema } from "mongoose";
import { IEmployee, IPerformanceNote } from "../../types";

const PerformanceNoteSchema = new Schema<IPerformanceNote>(
  {
    note: { type: String, required: true, maxlength: 2000 },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sentiment: { type: String, enum: ["positive", "neutral", "negative"] },
    sentimentScore: { type: Number, min: -1, max: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const EmployeeSchema = new Schema<IEmployee>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    department: {
      type: String,
      enum: ["engineering", "hr", "finance", "marketing", "operations", "sales", "legal"],
      required: true,
      index: true,
    },
    designation: { type: String, required: true, trim: true },
    salary: { type: Number, required: true, min: 0 },
    joiningDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "on_leave", "terminated", "probation"],
      default: "active",
      index: true,
    },
    skills: [{ type: String, trim: true }],
    performanceNotes: [PerformanceNoteSchema],
    attritionRisk: { type: Number, min: 0, max: 1 },
    attritionRiskUpdatedAt: { type: Date },
    manager: { type: Schema.Types.ObjectId, ref: "Employee" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for common queries
EmployeeSchema.index({ department: 1, status: 1 });
EmployeeSchema.index({ attritionRisk: -1 });
EmployeeSchema.index({ joiningDate: 1 });

// Text search index
EmployeeSchema.index({ designation: "text" });

export const Employee = mongoose.model<IEmployee>("Employee", EmployeeSchema);