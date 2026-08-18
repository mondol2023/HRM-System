// src/modules/leave/leaveBalance.model.ts
import mongoose, { Schema } from "mongoose";
import type { ILeaveBalance } from "../../types";

const LeaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    leaveType: { type: Schema.Types.ObjectId, ref: "LeaveType", required: true },
    year: { type: Number, required: true },
    // Recomputed deterministically on every read (see leave.service#getOrInitBalance) — this
    // field is a persisted cache for querying, not the source of truth for the number itself.
    accrued: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// One balance row per employee/type/year; also the natural lookup shape.
LeaveBalanceSchema.index({ employee: 1, leaveType: 1, year: 1 }, { unique: true });

LeaveBalanceSchema.virtual("remaining").get(function (this: ILeaveBalance) {
  return this.accrued - this.used;
});

export const LeaveBalance = mongoose.model<ILeaveBalance>("LeaveBalance", LeaveBalanceSchema);
