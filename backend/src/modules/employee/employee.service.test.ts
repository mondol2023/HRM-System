// src/modules/employee/employee.service.test.ts
import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { User } from "../auth/user.model";
import { AuditLog } from "../audit/audit.model";
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

const baseListQuery = {
  page: 1,
  limit: 20,
  sortBy: "createdAt" as const,
  sortOrder: "desc" as const,
};

describe("employeeService.list — manager scoping", () => {
  it("only returns a manager's own record + direct reports, never the whole company", async () => {
    const managerUser = await makeUser("manager");
    const managerRecord = await makeEmployee(managerUser._id);

    const reportUser = await makeUser("employee");
    await makeEmployee(reportUser._id, { manager: managerRecord._id });

    const strangerUser = await makeUser("employee");
    await makeEmployee(strangerUser._id); // unrelated, no manager link

    const result = await employeeService.list(baseListQuery, asPayload(managerUser));

    expect(result.data.length).toBe(2); // self + one report
    const ids = result.data.map((e) => String(e._id));
    expect(ids).toContain(String(managerRecord._id));
    expect(result.total).toBe(2);
  });

  it("returns an empty page for a manager with no Employee profile", async () => {
    const managerUser = await makeUser("manager");
    const result = await employeeService.list(baseListQuery, asPayload(managerUser));
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("lets admin/hr list company-wide, unscoped", async () => {
    const admin = await makeUser("admin");
    const owner = await makeUser("employee");
    await makeEmployee(owner._id);

    const result = await employeeService.list(baseListQuery, asPayload(admin));
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});

describe("employeeService.create/update — referential integrity", () => {
  it("rejects a create whose userId does not reference a real user", async () => {
    const admin = await makeUser("admin");
    await expect(
      employeeService.create(
        {
          userId: new Types.ObjectId(),
          employeeId: `E${Date.now()}`,
          department: "engineering",
          designation: "Engineer",
          salary: 1000,
          joiningDate: new Date(),
        } as never,
        asPayload(admin)
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a create whose manager does not reference a real employee", async () => {
    const admin = await makeUser("admin");
    const owner = await makeUser("employee");
    await expect(
      employeeService.create(
        {
          userId: owner._id,
          employeeId: `E${Date.now()}`,
          department: "engineering",
          designation: "Engineer",
          salary: 1000,
          joiningDate: new Date(),
          manager: new Types.ObjectId(),
        } as never,
        asPayload(admin)
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an update that makes an employee their own manager", async () => {
    const admin = await makeUser("admin");
    const owner = await makeUser("employee");
    const record = await makeEmployee(owner._id);

    await expect(
      employeeService.update(record._id.toString(), { manager: record._id } as never, asPayload(admin))
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("employeeService.create/update — audit trail", () => {
  it("records an audit entry with a field-level diff on update", async () => {
    const admin = await makeUser("admin");
    const owner = await makeUser("employee");
    const record = await makeEmployee(owner._id, { salary: 1000 });

    await employeeService.update(record._id.toString(), { salary: 2000 }, asPayload(admin), "127.0.0.1");

    const entries = await AuditLog.find({ targetId: record._id, action: "employee.update" }).lean();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.changes).toMatchObject({ salary: { from: 1000, to: 2000 } });
    expect(entries[0]?.actorId.toString()).toBe(admin._id.toString());
  });

  it("does not record an audit entry when the update is a no-op", async () => {
    const admin = await makeUser("admin");
    const owner = await makeUser("employee");
    const record = await makeEmployee(owner._id, { salary: 1000 });

    await employeeService.update(record._id.toString(), { salary: 1000 }, asPayload(admin));

    const entries = await AuditLog.find({ targetId: record._id, action: "employee.update" }).lean();
    expect(entries).toHaveLength(0);
  });

  it("records a terminate action with the prior status", async () => {
    const admin = await makeUser("admin");
    const owner = await makeUser("employee");
    const record = await makeEmployee(owner._id, { status: "active" });

    await employeeService.terminate(record._id.toString(), asPayload(admin));

    const entry = await AuditLog.findOne({ targetId: record._id, action: "employee.terminate" }).lean();
    expect(entry?.changes).toMatchObject({ status: { from: "active", to: "terminated" } });
  });
});
