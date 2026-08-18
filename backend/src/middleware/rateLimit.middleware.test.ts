// src/middleware/rateLimit.middleware.test.ts
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "./rateLimit.middleware";

const mockRes = (): Response => {
  const res: Partial<Response> = { setHeader: vi.fn() };
  return res as Response;
};

describe("rateLimit", () => {
  it("allows requests under the limit and blocks once exceeded", async () => {
    const limiter = rateLimit({ max: 3, windowSeconds: 60, scope: `test-${Date.now()}` });
    const req = { ip: "1.2.3.4", headers: {} } as Request;

    const calls: Array<unknown> = [];
    const next: NextFunction = (err?: unknown) => calls.push(err);

    for (let i = 0; i < 3; i += 1) {
      await new Promise<void>((resolve) => {
        limiter(req, mockRes(), (err?: unknown) => {
          calls.push(err);
          resolve();
        });
      });
    }
    expect(calls.filter((c) => c === undefined)).toHaveLength(3);

    await new Promise<void>((resolve) => {
      limiter(req, mockRes(), (err?: unknown) => {
        next(err);
        resolve();
      });
    });

    const last = calls[calls.length - 1];
    expect(last).toBeDefined();
    expect((last as { statusCode: number }).statusCode).toBe(429);
  });

  it("keys authenticated users by id, not IP", async () => {
    const scope = `test-user-${Date.now()}`;
    const limiter = rateLimit({ max: 1, windowSeconds: 60, scope });
    const reqA = { ip: "9.9.9.9", headers: {}, user: { id: "u1" } } as unknown as Request;
    const reqB = { ip: "9.9.9.9", headers: {}, user: { id: "u2" } } as unknown as Request;

    const results: Array<unknown> = [];
    await new Promise<void>((r) => limiter(reqA, mockRes(), (e) => { results.push(e); r(); }));
    await new Promise<void>((r) => limiter(reqB, mockRes(), (e) => { results.push(e); r(); }));

    // Same IP, different user id — both must pass their own independent quota.
    expect(results.every((r) => r === undefined)).toBe(true);
  });
});
