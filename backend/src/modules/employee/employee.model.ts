// src/modules/employee/employee.model.ts
import mongoose, { Schema } from "mongoose";
import {
  DEPARTMENTS,
  EMPLOYMENT_STATUSES,
  SENTIMENTS,
  asMutable,
} from "../../constants/enums";
import type { IEmployee, IPerformanceNote } from "../../types";

const PerformanceNoteSchema = new Schema<IPerformanceNote>(
  {
    note: { type: String, required: true, maxlength: 2000 },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sentiment: { type: String, enum: asMutable(SENTIMENTS) },
    sentimentScore: { type: Number, min: -1, max: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const EmployeeSchema = new Schema<IEmployee>(
  {
    // `unique` already builds the index — no separate `index: true`.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    department: { type: String, enum: asMutable(DEPARTMENTS), required: true },
    designation: { type: String, required: true, trim: true },
    salary: { type: Number, required: true, min: 0 },
    joiningDate: { type: Date, required: true },
    status: { type: String, enum: asMutable(EMPLOYMENT_STATUSES), default: "active" },
    skills: [{ type: String, trim: true }],
    performanceNotes: [PerformanceNoteSchema],
    attritionRisk: { type: Number, min: 0, max: 1 },
    attritionRiskUpdatedAt: { type: Date },
    manager: { type: Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Filter + sort in one index so the common list query never sorts in memory.
EmployeeSchema.index({ department: 1, status: 1, createdAt: -1 });
EmployeeSchema.index({ status: 1, attritionRisk: -1 });
EmployeeSchema.index({ joiningDate: -1 });
EmployeeSchema.index({ manager: 1 }); // direct-report lookups

// Free-text search; designation outweighs skills.
EmployeeSchema.index(
  { designation: "text", skills: "text" },
  { weights: { designation: 5, skills: 1 }, name: "employee_text" }
);

export const Employee = mongoose.model<IEmployee>("Employee", EmployeeSchema);
