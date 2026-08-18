// src/modules/employee/employee.controller.ts
import type { Response } from "express";
import { employeeService, type EmployeeListQuery } from "./employee.service";
import { created, ok, paginated } from "../../core/http/apiResponse";
import type { AuthRequest, IEmployee } from "../../types";

export const employeeController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    const result = await employeeService.list(req.query as unknown as EmployeeListQuery);
    paginated(res, result, "Employees fetched");
  },

  async getOne(req: AuthRequest, res: Response): Promise<void> {
    const employee = await employeeService.getById(req.params["id"]!, req.user!);
    ok(res, employee, "Employee fetched");
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    const employee = await employeeService.create(req.body as Partial<IEmployee>);
    created(res, employee, "Employee created");
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    const employee = await employeeService.update(req.params["id"]!, req.body as Partial<IEmployee>);
    ok(res, employee, "Employee updated");
  },

  async terminate(req: AuthRequest, res: Response): Promise<void> {
    await employeeService.terminate(req.params["id"]!);
    ok(res, null, "Employee terminated");
  },

  async addNote(req: AuthRequest, res: Response): Promise<void> {
    const { note } = req.body as { note: string };
    const employee = await employeeService.addPerformanceNote(req.params["id"]!, note, req.user!.id);
    created(res, employee, "Note added. AI analysis queued.");
  },

  async stats(_req: AuthRequest, res: Response): Promise<void> {
    const stats = await employeeService.getStats();
    ok(res, stats, "Stats fetched");
  },
};
