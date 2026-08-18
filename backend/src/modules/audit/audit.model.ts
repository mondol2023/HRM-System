// src/modules/audit/audit.model.ts
import mongoose, { Schema } from "mongoose";
import { AUDIT_ACTIONS, USER_ROLES, asMutable } from "../../constants/enums";
import type { IAuditLog } from "../../types";

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, enum: asMutable(USER_ROLES), required: true },
    action: { type: String, enum: asMutable(AUDIT_ACTIONS), required: true },
    targetType: { type: String, required: true, trim: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    // Field-level before/after only, never a full document — see IAuditChange.
    changes: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// No update/delete route is ever exposed for this model — the trail is append-only.
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
