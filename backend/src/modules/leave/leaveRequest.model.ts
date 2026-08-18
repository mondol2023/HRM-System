// src/modules/leave/leaveRequest.model.ts
import mongoose, { Schema } from "mongoose";
import { LEAVE_REQUEST_STATUSES, asMutable } from "../../constants/enums";
import type { ILeaveDecision, ILeaveRequest } from "../../types";

const LeaveDecisionSchema = new Schema<ILeaveDecision>(
  {
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true, default: Date.now },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    leaveType: { type: Schema.Types.ObjectId, ref: "LeaveType", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: asMutable(LEAVE_REQUEST_STATUSES), default: "pending" },
    managerDecision: { type: LeaveDecisionSchema },
    hrDecision: { type: LeaveDecisionSchema },
  },
  { timestamps: true }
);

// Approval queue view (per employee, most recent first) + overlap-check range scan.
LeaveRequestSchema.index({ employee: 1, status: 1, createdAt: -1 });
LeaveRequestSchema.index({ employee: 1, startDate: 1, endDate: 1 });
LeaveRequestSchema.index({ status: 1, createdAt: -1 });

export const LeaveRequest = mongoose.model<ILeaveRequest>("LeaveRequest", LeaveRequestSchema);
