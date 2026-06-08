// src/modules/employee/employee.service.ts
import mongoose from "mongoose";
import { Employee } from "./employee.model";
import { cacheGet, cacheSet, cacheDel, cacheInvalidatePattern } from "../../config/redis";
import { IEmployee, IPaginatedResponse, IPaginationQuery, AppError } from "../../types";
import { aiQueue } from "../ai/ai.queue";

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = "employees";

export class EmployeeService {
  // ─── List employees (paginated + cached) ──────────────────────────────────
  async list(query: IPaginationQuery): Promise<IPaginatedResponse<IEmployee>> {
    const { page = "1", limit = "20", search, department, status, sortBy = "createdAt", sortOrder = "desc" } = query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `${CACHE_PREFIX}:list:${JSON.stringify(query)}`;
    const cached = await cacheGet<IPaginatedResponse<IEmployee>>(cacheKey);
    if (cached) return cached;

    const filter: mongoose.FilterQuery<IEmployee> = {};
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { designation: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ];
    }

    const projection = {
      performanceNotes: 0, // exclude heavy field from list view
    };

    const [data, total] = await Promise.all([
      Employee.find(filter, projection)
        .populate("userId", "name email")
        .populate("manager", "employeeId designation")
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Employee.countDocuments(filter),
    ]);

    const result: IPaginatedResponse<IEmployee> = {
      data: data as unknown as IEmployee[],
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };

    await cacheSet(cacheKey, result, CACHE_TTL);
    return result;
  }

  // ─── Get single employee ──────────────────────────────────────────────────
  async getById(id: string): Promise<IEmployee> {
    const cacheKey = `${CACHE_PREFIX}:${id}`;
    const cached = await cacheGet<IEmployee>(cacheKey);
    if (cached) return cached;

    const emp = await Employee.findById(id)
      .populate("userId", "name email role")
      .populate("manager", "employeeId designation userId")
      .lean();

    if (!emp) throw new AppError("Employee not found", 404);

    await cacheSet(cacheKey, emp, CACHE_TTL);
    return emp as unknown as IEmployee;
  }

  // ─── Create employee ──────────────────────────────────────────────────────
  async create(data: Partial<IEmployee>): Promise<IEmployee> {
    const emp = await Employee.create(data);
    await cacheInvalidatePattern(`${CACHE_PREFIX}:list:*`);
    return emp;
  }

  // ─── Update employee ──────────────────────────────────────────────────────
  async update(id: string, data: Partial<IEmployee>): Promise<IEmployee> {
    const emp = await Employee.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
    if (!emp) throw new AppError("Employee not found", 404);

    await Promise.all([
      cacheInvalidatePattern(`${CACHE_PREFIX}:list:*`),
      cacheDel(`${CACHE_PREFIX}:${id}`),
    ]);

    return emp;
  }

  // ─── Delete (soft via status) ─────────────────────────────────────────────
  async terminate(id: string): Promise<void> {
    const emp = await Employee.findByIdAndUpdate(id, { status: "terminated" });
    if (!emp) throw new AppError("Employee not found", 404);
    await cacheInvalidatePattern(`${CACHE_PREFIX}:*`);
  }

  // ─── Add performance note + queue AI sentiment ────────────────────────────
  async addPerformanceNote(
    employeeId: string,
    note: string,
    addedBy: string
  ): Promise<IEmployee> {
    const emp = await Employee.findByIdAndUpdate(
      employeeId,
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

    if (!emp) throw new AppError("Employee not found", 404);

    // Queue background AI sentiment analysis
    const lastNote = emp.performanceNotes[emp.performanceNotes.length - 1];
    await aiQueue.add("sentiment", {
      employeeId,
      noteId: lastNote._id.toString(),
      note,
    });

    // Also queue attrition risk refresh
    await aiQueue.add("attrition", { employeeId });

    await cacheDel(`${CACHE_PREFIX}:${employeeId}`);
    return emp;
  }

  // ─── Dashboard stats ──────────────────────────────────────────────────────
  async getStats(): Promise<Record<string, unknown>> {
    const cacheKey = `${CACHE_PREFIX}:stats`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const [total, byDept, byStatus, highRisk] = await Promise.all([
      Employee.countDocuments(),
      Employee.aggregate([{ $group: { _id: "$department", count: { $sum: 1 } } }]),
      Employee.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Employee.countDocuments({ attritionRisk: { $gte: 0.7 } }),
    ]);

    const stats = { total, byDepartment: byDept, byStatus, highAttritionRisk: highRisk };
    await cacheSet(cacheKey, stats, 60);
    return stats;
  }
}

export const employeeService = new EmployeeService();