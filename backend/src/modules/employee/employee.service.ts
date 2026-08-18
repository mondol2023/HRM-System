// src/modules/employee/employee.service.ts
import mongoose from "mongoose";
import { Employee } from "./employee.model";
import { aiQueue } from "../ai/ai.queue";
import { cache, queryFingerprint } from "../../core/cache/cacheService";
import { CacheNamespace } from "../../constants/cacheKeys";
import { AppError } from "../../core/errors/AppError";
import { env } from "../../config/env";
import { PRIVILEGED_ROLES } from "../../constants/enums";
import type {
  Department,
  EmployeeSortField,
  EmploymentStatus,
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

export const employeeService = {
  async list(query: EmployeeListQuery): Promise<IPaginatedResponse<IEmployee>> {
    return cache.getOrSet(
      CacheNamespace.EMPLOYEE,
      `list:${queryFingerprint(query as unknown as Record<string, unknown>)}`,
      async () => {
        const skip = (query.page - 1) * query.limit;
        const filter = buildFilter(query);
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

  async create(data: Partial<IEmployee>): Promise<IEmployee> {
    const employee = await Employee.create(data);
    await cache.invalidateMany([CacheNamespace.EMPLOYEE, CacheNamespace.EMPLOYEE_STATS]);
    return employee;
  },

  async update(id: string, data: Partial<IEmployee>): Promise<IEmployee> {
    const employee = await Employee.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    ).lean<IEmployee | null>();

    if (!employee) throw AppError.notFound("Employee");
    await cache.invalidateMany([CacheNamespace.EMPLOYEE, CacheNamespace.EMPLOYEE_STATS]);
    return employee;
  },

  /** Soft delete: the record stays, the status changes. */
  async terminate(id: string): Promise<void> {
    const employee = await Employee.findByIdAndUpdate(id, { $set: { status: "terminated" } })
      .select("_id")
      .lean();

    if (!employee) throw AppError.notFound("Employee");
    await cache.invalidateMany([CacheNamespace.EMPLOYEE, CacheNamespace.EMPLOYEE_STATS]);
  },

  async addPerformanceNote(id: string, note: string, addedBy: string): Promise<IEmployee> {
    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        $push: {
          performanceNotes: {
            note,
            addedBy: new mongoose.Types.ObjectId(addedBy),
            addedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!employee) throw AppError.notFound("Employee");

    const lastNote = employee.performanceNotes[employee.performanceNotes.length - 1];

    // AI runs off-request: the caller never waits on OpenAI.
    await Promise.all([
      aiQueue.sentiment({ employeeId: id, noteId: String(lastNote?._id), note }),
      aiQueue.attrition(id),
      cache.invalidate(CacheNamespace.EMPLOYEE),
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

/**
 * Per-record access control. admin/hr see everyone, a manager sees themselves and
 * their direct reports, everyone else sees only their own record. Without this
 * any authenticated user could read any record by id.
 */
async function assertCanView(employee: IEmployee, requester: ITokenPayload): Promise<void> {
  if (PRIVILEGED_ROLES.includes(requester.role)) return;
  if (toId(employee.userId) === requester.id) return;

  if (requester.role === "manager") {
    const managerRecordId = await cache.getOrSet(
      CacheNamespace.EMPLOYEE,
      `by-user:${requester.id}`,
      async () => {
        const record = await Employee.findOne({ userId: requester.id }).select("_id").lean();
        return record ? String(record._id) : null;
      },
      { ttl: env.cacheTtl.entity, negativeTtl: 30 }
    );

    if (managerRecordId && toId(employee.manager) === managerRecordId) return;
  }

  throw AppError.forbidden("You do not have permission to view this employee");
}
