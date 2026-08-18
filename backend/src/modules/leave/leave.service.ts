// src/modules/leave/leave.service.ts
import { Types } from "mongoose";
import { Employee } from "../employee/employee.model";
import { LeaveType } from "./leaveType.model";
import { LeaveBalance } from "./leaveBalance.model";
import { LeaveRequest } from "./leaveRequest.model";
import { auditService } from "../audit/audit.service";
import { AppError } from "../../core/errors/AppError";
import { PRIVILEGED_ROLES } from "../../constants/enums";
import type {
  ILeaveBalance,
  ILeaveRequest,
  ILeaveType,
  IPaginatedResponse,
  ITokenPayload,
  LeaveRequestStatus,
} from "../../types";

export interface LeaveRequestListQuery {
  page: number;
  limit: number;
  status?: LeaveRequestStatus;
  employee?: string;
  leaveType?: string;
}

// ─── Small date helpers (no holiday calendar yet — see backendplan.md) ────────
const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const countBusinessDays = (start: Date, end: Date): number => {
  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

/** Whole calendar months from `from` to `to`, both clamped into the same year by the caller. */
const monthSpan = (from: Date, to: Date): number => to.getMonth() - from.getMonth() + 1;

const computeAccrued = (leaveType: ILeaveType, year: number, joiningDate: Date, asOf: Date): number => {
  if (leaveType.accrualMethod === "fixed") return leaveType.defaultAnnualDays;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const from = joiningDate > yearStart ? joiningDate : yearStart;
  const to = asOf < yearEnd ? asOf : yearEnd;
  if (to < from) return 0;

  const months = Math.max(0, monthSpan(from, to));
  const monthlyRate = leaveType.defaultAnnualDays / 12;
  return Math.min(leaveType.defaultAnnualDays, Math.round(monthlyRate * months * 100) / 100);
};

/** The requesting user's own Employee record, or null if this account has no employee profile. */
const getOwnEmployee = async (userId: string) => Employee.findOne({ userId }).lean();

/** Idempotent: recomputes and upserts the current-year balance for one employee/type. */
const getOrInitBalance = async (
  employeeId: string,
  employeeJoiningDate: Date,
  leaveType: ILeaveType,
  year: number
): Promise<ILeaveBalance> => {
  const accrued = computeAccrued(leaveType, year, employeeJoiningDate, new Date());
  return LeaveBalance.findOneAndUpdate(
    { employee: employeeId, leaveType: leaveType._id, year },
    { $set: { accrued }, $setOnInsert: { used: 0 } },
    { upsert: true, new: true, runValidators: true }
  );
};

/** null = actor has no Employee profile, so can't be anyone's manager. */
const getManagerEmployeeId = async (userId: string): Promise<string | null> => {
  const record = await getOwnEmployee(userId);
  return record ? String(record._id) : null;
};

export const leaveTypeService = {
  async list(activeOnly = false): Promise<ILeaveType[]> {
    const filter = activeOnly ? { active: true } : {};
    return LeaveType.find(filter).sort({ name: 1 }).lean<ILeaveType[]>();
  },

  async create(data: Partial<ILeaveType>): Promise<ILeaveType> {
    return LeaveType.create(data);
  },

  async update(id: string, data: Partial<ILeaveType>): Promise<ILeaveType> {
    const updated = await LeaveType.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
    if (!updated) throw AppError.notFound("Leave type");
    return updated;
  },
};

export const leaveService = {
  /** Every active leave type's current-year balance for the caller's own employee profile. */
  async myBalances(actor: ITokenPayload): Promise<Array<{ leaveType: ILeaveType; accrued: number; used: number; remaining: number }>> {
    const employee = await getOwnEmployee(actor.id);
    if (!employee) throw AppError.badRequest("No employee profile linked to this account");

    const types = await LeaveType.find({ active: true, tracksBalance: true }).lean<ILeaveType[]>();
    const year = new Date().getFullYear();

    return Promise.all(
      types.map(async (leaveType) => {
        const balance = await getOrInitBalance(String(employee._id), employee.joiningDate, leaveType, year);
        return { leaveType, accrued: balance.accrued, used: balance.used, remaining: balance.accrued - balance.used };
      })
    );
  },

  async create(
    input: { leaveType: string; startDate: Date; endDate: Date; reason: string },
    actor: ITokenPayload,
    ip?: string
  ): Promise<ILeaveRequest> {
    const employee = await getOwnEmployee(actor.id);
    if (!employee) throw AppError.badRequest("No employee profile linked to this account");

    const leaveType = await LeaveType.findById(input.leaveType);
    if (!leaveType || !leaveType.active) throw AppError.badRequest("Leave type not found or inactive");

    const startDate = startOfDay(new Date(input.startDate));
    const endDate = startOfDay(new Date(input.endDate));
    if (startDate < startOfDay(new Date())) throw AppError.badRequest("Cannot request leave that starts in the past");

    const days = countBusinessDays(startDate, endDate);
    if (days < 1) throw AppError.badRequest("Selected range has no working days");

    const overlap = await LeaveRequest.exists({
      employee: employee._id,
      status: { $in: ["pending", "manager_approved", "approved"] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
    if (overlap) throw AppError.conflict("Overlaps an existing leave request");

    if (leaveType.tracksBalance && !leaveType.allowNegativeBalance) {
      const balance = await getOrInitBalance(String(employee._id), employee.joiningDate, leaveType, startDate.getFullYear());
      if (balance.accrued - balance.used < days) throw AppError.badRequest("Insufficient leave balance");
    }

    const request = await LeaveRequest.create({
      employee: employee._id,
      leaveType: leaveType._id,
      startDate,
      endDate,
      days,
      reason: input.reason,
      status: "pending",
    });

    await auditService.record({
      actor,
      action: "leave.request.create",
      targetType: "LeaveRequest",
      targetId: String(request._id),
      changes: { status: { from: undefined, to: "pending" } },
      ip,
    });

    return request;
  },

  /**
   * Single entry point for both approval stages. Which stage applies is derived
   * from the request's current status, not from the caller's role — the manager
   * stage happens at "pending", the HR stage (only for types that require it)
   * happens at "manager_approved". Authorization is data-dependent (is this
   * actor *this employee's* manager?), so it lives here rather than in
   * middleware — same documented exception as `assertCanView` in employee.service.
   */
  async decide(requestId: string, decision: "approve" | "reject", comment: string | undefined, actor: ITokenPayload, ip?: string): Promise<ILeaveRequest> {
    const request = await LeaveRequest.findById(requestId);
    if (!request) throw AppError.notFound("Leave request");

    const leaveType = await LeaveType.findById(request.leaveType);
    if (!leaveType) throw AppError.notFound("Leave type");

    const isPrivileged = PRIVILEGED_ROLES.includes(actor.role);
    const decisionEntry = { by: new Types.ObjectId(actor.id), at: new Date(), comment };

    if (request.status === "pending") {
      if (!isPrivileged) {
        const managerId = await getManagerEmployeeId(actor.id);
        const employee = await Employee.findById(request.employee).select("manager").lean();
        if (!managerId || String(employee?.manager) !== managerId) {
          throw AppError.forbidden("You are not the manager of this employee");
        }
      }

      request.managerDecision = decisionEntry;
      if (decision === "reject") {
        request.status = "rejected";
      } else if (leaveType.requiresHRApproval) {
        request.status = "manager_approved";
      } else {
        await finalizeApproval(request, leaveType);
      }
    } else if (request.status === "manager_approved") {
      if (!isPrivileged) throw AppError.forbidden("Only HR/admin can give final approval for this leave type");

      request.hrDecision = decisionEntry;
      if (decision === "reject") request.status = "rejected";
      else await finalizeApproval(request, leaveType);
    } else {
      throw AppError.conflict("This leave request has already been decided");
    }

    await request.save();
    await auditService.record({
      actor,
      action: decision === "approve" ? "leave.request.approve" : "leave.request.reject",
      targetType: "LeaveRequest",
      targetId: requestId,
      changes: { status: { from: undefined, to: request.status } },
      ip,
    });

    return request;
  },

  async cancel(requestId: string, actor: ITokenPayload, ip?: string): Promise<ILeaveRequest> {
    const request = await LeaveRequest.findById(requestId);
    if (!request) throw AppError.notFound("Leave request");

    if (!PRIVILEGED_ROLES.includes(actor.role)) {
      const employee = await getOwnEmployee(actor.id);
      if (!employee || String(request.employee) !== String(employee._id)) {
        throw AppError.forbidden("You can only cancel your own leave request");
      }
    }

    if (request.status === "rejected" || request.status === "cancelled") {
      throw AppError.conflict("This leave request is already closed");
    }
    if (request.status === "approved" && request.startDate <= new Date()) {
      throw AppError.badRequest("Cannot cancel a leave that has already started");
    }

    if (request.status === "approved") {
      const leaveType = await LeaveType.findById(request.leaveType);
      if (leaveType?.tracksBalance) {
        await LeaveBalance.updateOne(
          { employee: request.employee, leaveType: request.leaveType, year: request.startDate.getFullYear() },
          { $inc: { used: -request.days } }
        );
      }
    }

    request.status = "cancelled";
    await request.save();

    await auditService.record({
      actor,
      action: "leave.request.cancel",
      targetType: "LeaveRequest",
      targetId: requestId,
      changes: { status: { from: undefined, to: "cancelled" } },
      ip,
    });

    return request;
  },

  async list(query: LeaveRequestListQuery, requester: ITokenPayload): Promise<IPaginatedResponse<ILeaveRequest>> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter["status"] = query.status;
    if (query.leaveType) filter["leaveType"] = query.leaveType;

    if (PRIVILEGED_ROLES.includes(requester.role)) {
      if (query.employee) filter["employee"] = query.employee;
    } else if (requester.role === "manager") {
      const managerId = await getManagerEmployeeId(requester.id);
      if (!managerId) return emptyPage(query);
      const reports = await Employee.find({ manager: managerId }).select("_id").lean();
      const scopedIds = [managerId, ...reports.map((r) => String(r._id))];
      filter["employee"] = query.employee && scopedIds.includes(query.employee) ? query.employee : { $in: scopedIds };
    } else {
      const employee = await getOwnEmployee(requester.id);
      if (!employee) return emptyPage(query);
      filter["employee"] = String(employee._id);
    }

    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      LeaveRequest.find(filter)
        .populate("employee", "employeeId department designation")
        .populate("leaveType", "name code paid")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean<ILeaveRequest[]>(),
      LeaveRequest.countDocuments(filter),
    ]);

    return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  },
};

const emptyPage = (query: LeaveRequestListQuery): IPaginatedResponse<ILeaveRequest> => ({
  data: [],
  total: 0,
  page: query.page,
  limit: query.limit,
  totalPages: 0,
});

async function finalizeApproval(request: ILeaveRequest, leaveType: ILeaveType): Promise<void> {
  request.status = "approved";
  if (leaveType.tracksBalance) {
    const employee = await Employee.findById(request.employee).select("joiningDate").lean();
    await getOrInitBalance(
      String(request.employee),
      employee?.joiningDate ?? request.startDate,
      leaveType,
      request.startDate.getFullYear()
    );
    await LeaveBalance.updateOne(
      { employee: request.employee, leaveType: leaveType._id, year: request.startDate.getFullYear() },
      { $inc: { used: request.days } }
    );
  }
}
