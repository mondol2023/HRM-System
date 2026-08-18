// src/modules/leave/leave.controller.ts
import type { Response } from "express";
import { leaveService, leaveTypeService, type LeaveRequestListQuery } from "./leave.service";
import { created, ok, paginated } from "../../core/http/apiResponse";
import type { AuthRequest, ILeaveType } from "../../types";

export const leaveTypeController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    // Non-privileged callers only need the active policies to build a request form.
    const activeOnly = !["admin", "hr"].includes(req.user!.role);
    const types = await leaveTypeService.list(activeOnly);
    ok(res, types, "Leave types fetched");
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    const leaveType = await leaveTypeService.create(req.body as Partial<ILeaveType>);
    created(res, leaveType, "Leave type created");
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    const leaveType = await leaveTypeService.update(req.params["id"]!, req.body as Partial<ILeaveType>);
    ok(res, leaveType, "Leave type updated");
  },
};

export const leaveController = {
  async myBalances(req: AuthRequest, res: Response): Promise<void> {
    const balances = await leaveService.myBalances(req.user!);
    ok(res, balances, "Leave balances fetched");
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    const request = await leaveService.create(
      req.body as { leaveType: string; startDate: Date; endDate: Date; reason: string },
      req.user!,
      req.ip
    );
    created(res, request, "Leave request submitted");
  },

  async list(req: AuthRequest, res: Response): Promise<void> {
    const result = await leaveService.list(req.query as unknown as LeaveRequestListQuery, req.user!);
    paginated(res, result, "Leave requests fetched");
  },

  async decide(req: AuthRequest, res: Response): Promise<void> {
    const { decision, comment } = req.body as { decision: "approve" | "reject"; comment?: string };
    const request = await leaveService.decide(req.params["id"]!, decision, comment, req.user!, req.ip);
    ok(res, request, "Leave request updated");
  },

  async cancel(req: AuthRequest, res: Response): Promise<void> {
    const request = await leaveService.cancel(req.params["id"]!, req.user!, req.ip);
    ok(res, request, "Leave request cancelled");
  },
};
