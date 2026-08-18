// src/modules/audit/audit.controller.ts
import type { Response } from "express";
import { auditService, type AuditListQuery } from "./audit.service";
import { paginated } from "../../core/http/apiResponse";
import type { AuthRequest } from "../../types";

export const auditController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    const result = await auditService.list(req.query as unknown as AuditListQuery);
    paginated(res, result, "Audit log fetched");
  },
};
