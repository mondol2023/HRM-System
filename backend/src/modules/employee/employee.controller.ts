// src/modules/employee/employee.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest, IPaginationQuery } from "../../types";
import { employeeService } from "./employee.service";

export class EmployeeController {
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await employeeService.list(req.query as IPaginationQuery);
      res.json({ success: true, message: "Employees fetched", data: result });
    } catch (err) { next(err); }
  }

  async getOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const emp = await employeeService.getById(req.params["id"]!);
      res.json({ success: true, message: "Employee fetched", data: emp });
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const emp = await employeeService.create(req.body);
      res.status(201).json({ success: true, message: "Employee created", data: emp });
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const emp = await employeeService.update(req.params["id"]!, req.body);
      res.json({ success: true, message: "Employee updated", data: emp });
    } catch (err) { next(err); }
  }

  async terminate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await employeeService.terminate(req.params["id"]!);
      res.json({ success: true, message: "Employee terminated" });
    } catch (err) { next(err); }
  }

  async addNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { note } = req.body as { note: string };
      const emp = await employeeService.addPerformanceNote(
        req.params["id"]!,
        note,
        req.user!.id
      );
      res.status(201).json({ success: true, message: "Note added. AI analysis queued.", data: emp });
    } catch (err) { next(err); }
  }

  async stats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employeeService.getStats();
      res.json({ success: true, message: "Stats fetched", data });
    } catch (err) { next(err); }
  }
}

export const employeeController = new EmployeeController();