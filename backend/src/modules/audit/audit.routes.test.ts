// src/modules/audit/audit.routes.test.ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../app";
import { User } from "../auth/user.model";
import { tokenService } from "../auth/token.service";
import { auditService } from "./audit.service";
import type { ITokenPayload } from "../../types";

const app = createApp();

const makeUser = async (role: ITokenPayload["role"]) =>
  User.create({ name: role, email: `${role}-${Date.now()}-${Math.random()}@x.com`, password: "Passw0rd!23", role });

const tokenFor = async (user: { _id: unknown; email: string; role: ITokenPayload["role"] }) =>
  (await tokenService.issue({ id: String(user._id), email: user.email, role: user.role })).accessToken;

describe("GET /api/v1/audit", () => {
  it("rejects hr and employee, allows admin", async () => {
    const hr = await makeUser("hr");
    const admin = await makeUser("admin");

    const hrRes = await request(app).get("/api/v1/audit").set("Authorization", `Bearer ${await tokenFor(hr)}`);
    expect(hrRes.status).toBe(403);

    const adminRes = await request(app).get("/api/v1/audit").set("Authorization", `Bearer ${await tokenFor(admin)}`);
    expect(adminRes.status).toBe(200);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/audit");
    expect(res.status).toBe(401);
  });

  it("filters by action and target", async () => {
    const admin = await makeUser("admin");
    const actor = await makeUser("hr");
    const targetId = String(new Types.ObjectId());

    await auditService.record({
      actor: { id: String(actor._id), email: actor.email, role: actor.role },
      action: "employee.terminate",
      targetType: "Employee",
      targetId,
      changes: { status: { from: "active", to: "terminated" } },
    });

    const res = await request(app)
      .get(`/api/v1/audit?action=employee.terminate&targetId=${targetId}`)
      .set("Authorization", `Bearer ${await tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0].action).toBe("employee.terminate");
  });
});
