// src/modules/audit/audit.service.ts
import { AuditLog } from "./audit.model";
import { logger } from "../../config/logger";
import type { AuditAction, IAuditChange, IAuditLog, IPaginatedResponse, ITokenPayload } from "../../types";

export interface AuditEntry {
  actor: ITokenPayload;
  action: AuditAction;
  targetType: string;
  targetId: string;
  changes?: Record<string, IAuditChange>;
  ip?: string;
}

export interface AuditListQuery {
  page: number;
  limit: number;
  targetType?: string;
  targetId?: string;
  actorId?: string;
  action?: AuditAction;
}

export const auditService = {
  /**
   * Best-effort by design: a failed audit write must never fail the business
   * operation it's recording (Phase 12 wants a trail, not a new outage source).
   * Failures are logged loudly instead of silently swallowed.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actor.id,
        actorRole: entry.actor.role,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        changes: entry.changes,
        ip: entry.ip,
      });
    } catch (error) {
      logger.error("Audit log write failed", {
        action: entry.action,
        targetId: entry.targetId,
        error: (error as Error).message,
      });
    }
  },

  /** Admin-only reader (see routes) — not cached, review must always reflect the latest state. */
  async list(query: AuditListQuery): Promise<IPaginatedResponse<IAuditLog>> {
    const filter: Record<string, unknown> = {};
    if (query.targetType) filter["targetType"] = query.targetType;
    if (query.targetId) filter["targetId"] = query.targetId;
    if (query.actorId) filter["actorId"] = query.actorId;
    if (query.action) filter["action"] = query.action;

    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actorId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean<IAuditLog[]>(),
      AuditLog.countDocuments(filter),
    ]);

    return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  },
};
