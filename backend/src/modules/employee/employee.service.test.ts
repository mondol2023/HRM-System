// src/modules/employee/employee.service.test.ts
import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { User } from "../auth/user.model";
import { Employee } from "./employee.model";
import { employeeService } from "./employee.service";
import type { ITokenPayload } from "../../types";

const makeUser = async (role: ITokenPayload["role"]) =>
  User.create({ name: role, email: `${role}-${Date.now()}-${Math.random()}@x.com`, password: "Passw0rd!23", role });

const makeEmployee = async (userId: Types.ObjectId, overrides: Record<string, unknown> = {}) =>
  Employee.create({
    userId,
    employeeId: `E${Date.now()}${Math.floor(Math.random() * 1000)}`,
    department: "engineering",
    designation: "Engineer",
    salary: 1000,
    joiningDate: new Date(),
    ...overrides,
  });

const asPayload = (user: { _id: Types.ObjectId; email: string; role: ITokenPayload["role"] }): ITokenPayload => ({
  id: user._id.toString(),
  email: user.email,
  role: user.role,
});

describe("employeeService.getById — access control", () => {
  it("lets admin view any record", async () => {
    const owner = await makeUser("employee");
    const admin = await makeUser("admin");
    const record = await makeEmployee(owner._id);

    await expect(employeeService.getById(record._id.toString(), asPayload(admin))).resolves.toBeDefined();
  });

  it("lets an employee view their own record", async () => {
    const owner = await makeUser("employee");
    const record = await makeEmployee(owner._id);

    await expect(employeeService.getById(record._id.toString(), asPayload(owner))).resolves.toBeDefined();
  });

  it("blocks an employee from viewing another employee's record", async () => {
    const owner = await makeUser("employee");
    const stranger = await makeUser("employee");
    const record = await makeEmployee(owner._id);

    await expect(employeeService.getById(record._id.toString(), asPayload(stranger))).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("lets a manager view a direct report but not an unrelated employee", async () => {
    const managerUser = await makeUser("manager");
    const managerRecord = await makeEmployee(managerUser._id);

    const reportUser = await makeUser("employee");
    const report = await makeEmployee(reportUser._id, { manager: managerRecord._id });

    const strangerUser = await makeUser("employee");
    const stranger = await makeEmployee(strangerUser._id);

    await expect(
      employeeService.getById(report._id.toString(), asPayload(managerUser))
    ).resolves.toBeDefined();

    await expect(
      employeeService.getById(stranger._id.toString(), asPayload(managerUser))
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 404 for a non-existent id", async () => {
    const admin = await makeUser("admin");
    await expect(
      employeeService.getById(new Types.ObjectId().toString(), asPayload(admin))
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
