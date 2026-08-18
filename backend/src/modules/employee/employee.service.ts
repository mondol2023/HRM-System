// src/modules/employee/employee.service.ts
import mongoose from "mongoose";
import { Employee } from "./employee.model";
import { User } from "../auth/user.model";
import { aiQueue } from "../ai/ai.queue";
import { auditService } from "../audit/audit.service";
import { cache, queryFingerprint } from "../../core/cache/cacheService";
import { CacheNamespace } from "../../constants/cacheKeys";
import { AppError } from "../../core/errors/AppError";
import { env } from "../../config/env";
import { PRIVILEGED_ROLES } from "../../constants/enums";
import type {
  Department,
  EmployeeSortField,
  EmploymentStatus,
  IAuditChange,
  IEmployee,
  IPaginatedResponse,
  ITokenPayload,
} from "../../types";

export interface EmployeeListQuery {
  page: number;
  limit: number;
  search?: string;
  department?: Department;
  status?: EmploymentStatus;
  sortBy: EmployeeSortField;
  sortOrder: "asc" | "desc";
}

/** Notes are unbounded and unused by the list view. */
const LIST_PROJECTION = { performanceNotes: 0 } as const;

/** A bare employee code short-circuits to an exact index hit; anything else is $text. */
const EMPLOYEE_CODE = /^[A-Za-z0-9]{3,20}$/;

const toId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const id = (value as { _id?: unknown })._id ?? value;
  return String(id);
};

const buildFilter = (query: EmployeeListQuery): mongoose.FilterQuery<IEmployee> => {
  const filter: mongoose.FilterQuery<IEmployee> = {};
  if (query.department) filter.department = query.department;
  if (query.status) filter.status = query.status;

  if (query.search) {
    if (EMPLOYEE_CODE.test(query.search)) filter.employeeId = query.search.toUpperCase();
    else filter.$text = { $search: query.search };
  }
  return filter;
};

const EMPTY_PAGE = (query: EmployeeListQuery): IPaginatedResponse<IEmployee> => ({
  data: [],
  total: 0,
  page: query.page,
  limit: query.limit,
  totalPages: 0,
});

/** Field-level diff for the audit trail — only the keys the caller actually sent. */
const diffChanges = (
  before: Record<string, unknown>,
  after: Partial<IEmployee>
): Record<string, IAuditChange> => {
  const changes: Record<string, IAuditChange> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = (after as Record<string, unknown>)[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
};

export const employeeService = {
  /**
   * A manager only sees their own record + direct reports here — the same
   * scope `getById` enforces. Without this a manager role (allowed to hit
   * this endpoint) could list, filter and sort every employee company-wide,
   * salary included.
   */
  async list(query: EmployeeListQuery, requester: ITokenPayload): Promise<IPaginatedResponse<IEmployee>> {
    let managerRecordId: string | null | undefined;
    let cacheSuffix = `list:${queryFingerprint(query as unknown as Record<string, unknown>)}`;

    if (requester.role === "manager") {
      managerRecordId = await getManagerRecordId(requester.id);
      if (!managerRecordId) return EMPTY_PAGE(query);
      cacheSuffix = `list:mgr:${managerRecordId}:${queryFingerprint(query as unknown as Record<string, unknown>)}`;
    }

    return cache.getOrSet(
      CacheNamespace.EMPLOYEE,
      cacheSuffix,
      async () => {
        const skip = (query.page - 1) * query.limit;
        const filter = buildFilter(query);
        if (managerRecordId) {
          filter.$or = [{ manager: managerRecordId }, { _id: managerRecordId }];
        }
        const sort: Record<string, 1 | -1> = { [query.sortBy]: query.sortOrder === "asc" ? 1 : -1 };

        const [data, total] = await Promise.all([
          Employee.find(filter, LIST_PROJECTION)
            .populate("userId", "name email")
            .populate("manager", "employeeId designation")
            .sort(sort)
            .skip(skip)
            .limit(query.limit)
            .lean<IEmployee[]>(),
          Employee.countDocuments(filter),
        ]);

        return {
          data,
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        };
      },
      { ttl: env.cacheTtl.list }
    );
  },

  async getById(id: string, requester: ITokenPayload): Promise<IEmployee> {
    // Cached before authorization — the entry is requester-independent, the check is not.
    const employee = await cache.getOrSet(
      CacheNamespace.EMPLOYEE,
      id,
      async () =>
        Employee.findById(id)
          .populate("userId", "name email role")
          .populate("manager", "employeeId designation userId")
          .lean<IEmployee | null>(),
      { ttl: env.cacheTtl.entity, negativeTtl: 15 }
    );

    if (!employee) throw AppError.notFound("Employee");
    await assertCanView(employee, requester);
    return employee;
  },

  async create(data: Partial<IEmployee>, actor: ITokenPayload, ip?: string): Promise<IEmployee> {
    if (!(await User.exists({ _id: data.userId }))) {
      throw AppError.badRequest("userId does not reference an existing user");
    }
    if (data.manager && !(await Employee.exists({ _id: data.manager }))) {
      throw AppError.badRequest("manager does not reference an existing employee");
    }

    const employee = await Employee.create(data);
    await cache.invalidateMany([CacheNamespace.EMPLOYEE, CacheNamespace.EMPLOYEE_STATS]);

    await auditService.record({
      actor,
      action: "employee.create",
      targetType: "Employee",
      targetId: String(employee._id),
      changes: diffChanges({}, data),
      ip,
    });

    return employee;
  },

  async update(id: string, data: Partial<IEmployee>, actor: ITokenPayload, ip?: string): Promise<IEmployee> {
    if (data.manager) {
      // A self-referential manager would make an employee their own report.
      if (String(data.manager) === id) throw AppError.badRequest("An employee cannot be their own manager");
      if (!(await Employee.exists({ _id: data.manager }))) {
        throw AppError.badRequest("manager does not reference an existing employee");
      }
    }

    // new:false (default) returns the pre-update doc atomically, so the audit
    // diff can't race a concurrent write the way a separate read-then-update would.
    const before = await Employee.findByIdAndUpdate(id, { $set: data }, { runValidators: true })
      .select(Object.keys(data).join(" "))
      .lean<Record<string, unknown> | null>();
    if (!before) throw AppError.notFound("Employee");

    const employee = await Employee.findById(id).lean<IEmployee | null>();
    if (!employee) throw AppError.notFound("Employee");

    await cache.invalidateMany([CacheNamespace.EMPLOYEE, CacheNamespace.EMPLOYEE_STATS]);

    const changes = diffChanges(before, data);
    if (Object.keys(changes).length > 0) {
      await auditService.record({ actor, action: "employee.update", targetType: "Employee", targetId: id, changes, ip });
    }

    return employee;
  },

  /** Soft delete: the record stays, the status changes. */
  async terminate(id: string, actor: ITokenPayload, ip?: string): Promise<void> {
    const before = await Employee.findByIdAndUpdate(id, { $set: { status: "terminated" } })
      .select("status")
      .lean<{ status: EmploymentStatus } | null>();

    if (!before) throw AppError.notFound("Employee");
    await cache.invalidateMany([CacheNamespace.EMPLOYEE, CacheNamespace.EMPLOYEE_STATS]);

    await auditService.record({
      actor,
      action: "employee.terminate",
      targetType: "Employee",
      targetId: id,
      changes: { status: { from: before.status, to: "terminated" } },
      ip,
    });
  },

  async addPerformanceNote(id: string, note: string, actor: ITokenPayload, ip?: string): Promise<IEmployee> {
    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        $push: {
          performanceNotes: {
            note,
            addedBy: new mongoose.Types.ObjectId(actor.id),
            addedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!employee) throw AppError.notFound("Employee");

    const lastNote = employee.performanceNotes[employee.performanceNotes.length - 1];

    // AI runs off-request: the caller never waits on OpenAI. Note content itself
    // isn't duplicated into the audit entry — it already lives on the employee record.
    await Promise.all([
      aiQueue.sentiment({ employeeId: id, noteId: String(lastNote?._id), note }),
      aiQueue.attrition(id),
      cache.invalidate(CacheNamespace.EMPLOYEE),
      auditService.record({
        actor,
        action: "employee.note.add",
        targetType: "Employee",
        targetId: id,
        changes: { noteId: { from: undefined, to: String(lastNote?._id) } },
        ip,
      }),
    ]);

    return employee;
  },

  async getStats(): Promise<Record<string, unknown>> {
    return cache.getOrSet(
      CacheNamespace.EMPLOYEE_STATS,
      "global",
      async () => {
        // One pass over the collection instead of four separate scans.
        const [result] = await Employee.aggregate<{
          total: [{ count: number }?];
          byDepartment: { _id: string; count: number }[];
          byStatus: { _id: string; count: number }[];
          highAttritionRisk: [{ count: number }?];
        }>([
          {
            $facet: {
              total: [{ $count: "count" }],
              byDepartment: [{ $group: { _id: "$department", count: { $sum: 1 } } }],
              byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
              highAttritionRisk: [{ $match: { attritionRisk: { $gte: 0.7 } } }, { $count: "count" }],
            },
          },
        ]);

        return {
          total: result?.total[0]?.count ?? 0,
          byDepartment: result?.byDepartment ?? [],
          byStatus: result?.byStatus ?? [],
          highAttritionRisk: result?.highAttritionRisk[0]?.count ?? 0,
        };
      },
      { ttl: env.cacheTtl.stats }
    );
  },
};

/** The requesting manager's own Employee _id, or null if they have no profile. */
async function getManagerRecordId(requesterId: string): Promise<string | null> {
  return cache.getOrSet(
    CacheNamespace.EMPLOYEE,
    `by-user:${requesterId}`,
    async () => {
      const record = await Employee.findOne({ userId: requesterId }).select("_id").lean();
      return record ? String(record._id) : null;
    },
    { ttl: env.cacheTtl.entity, negativeTtl: 30 }
  );
}

/**
 * Per-record access control. admin/hr see everyone, a manager sees themselves and
 * their direct reports, everyone else sees only their own record. Without this
 * any authenticated user could read any record by id.
 */
async function assertCanView(employee: IEmployee, requester: ITokenPayload): Promise<void> {
  if (PRIVILEGED_ROLES.includes(requester.role)) return;
  if (toId(employee.userId) === requester.id) return;

  if (requester.role === "manager") {
    const managerRecordId = await getManagerRecordId(requester.id);
    if (managerRecordId && toId(employee.manager) === managerRecordId) return;
  }

  throw AppError.forbidden("You do not have permission to view this employee");
}
