// src/modules/leave/leaveType.model.ts
import mongoose, { Schema } from "mongoose";
import { LEAVE_ACCRUAL_METHODS, asMutable } from "../../constants/enums";
import type { ILeaveType } from "../../types";

const LeaveTypeSchema = new Schema<ILeaveType>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    accrualMethod: { type: String, enum: asMutable(LEAVE_ACCRUAL_METHODS), required: true },
    defaultAnnualDays: { type: Number, required: true, min: 0, max: 365 },
    paid: { type: Boolean, required: true },
    tracksBalance: { type: Boolean, default: true },
    allowNegativeBalance: { type: Boolean, default: false },
    requiresHRApproval: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LeaveType = mongoose.model<ILeaveType>("LeaveType", LeaveTypeSchema);
