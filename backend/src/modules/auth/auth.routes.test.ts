// src/modules/auth/auth.routes.test.ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";

const app = createApp();

const credentials = { name: "Test User", email: `test-${Date.now()}@example.com`, password: "Passw0rd!23" };

describe("auth flow", () => {
  it("registers, ignores a client-supplied role, and returns tokens", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...credentials, role: "admin" });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("employee"); // role injection must be stripped
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it("rejects a duplicate registration", async () => {
    await request(app).post("/api/v1/auth/register").send(credentials);
    const res = await request(app).post("/api/v1/auth/register").send(credentials);
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    await request(app).post("/api/v1/auth/register").send(credentials);

    const ok = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(ok.status).toBe(200);

    const bad = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: "WrongPass1!" });
    expect(bad.status).toBe(401);
  });

  it("rotates the refresh token and rejects replay", async () => {
    const register = await request(app).post("/api/v1/auth/register").send(credentials);
    const refreshToken = register.body.data.refreshToken as string;

    const first = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(first.status).toBe(200);

    const replay = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it("rejects /me without a token and accepts with one", async () => {
    const register = await request(app).post("/api/v1/auth/register").send(credentials);
    const accessToken = register.body.data.accessToken as string;

    const anon = await request(app).get("/api/v1/auth/me");
    expect(anon.status).toBe(401);

    const authed = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(authed.status).toBe(200);
    expect(authed.body.data.email).toBe(credentials.email);
  });
});
