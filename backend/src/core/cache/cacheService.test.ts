// src/core/cache/cacheService.test.ts
import { describe, expect, it, vi } from "vitest";
import { cache, queryFingerprint } from "./cacheService";

describe("cache", () => {
  it("caches a loader result and skips a second call on hit", async () => {
    const loader = vi.fn().mockResolvedValue({ hello: "world" });

    const first = await cache.getOrSet("test:ns", "key1", loader, { ttl: 30 });
    const second = await cache.getOrSet("test:ns", "key1", loader, { ttl: 30 });

    expect(first).toEqual({ hello: "world" });
    expect(second).toEqual({ hello: "world" });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidate makes the next read call the loader again", async () => {
    const loader = vi.fn().mockResolvedValueOnce({ v: 1 }).mockResolvedValueOnce({ v: 2 });

    await cache.getOrSet("test:inv", "key1", loader, { ttl: 30 });
    await cache.invalidate("test:inv");
    const after = await cache.getOrSet("test:inv", "key1", loader, { ttl: 30 });

    expect(after).toEqual({ v: 2 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("negative-caches a null result separately from a real miss", async () => {
    const loader = vi.fn().mockResolvedValue(null);

    await cache.getOrSet("test:neg", "key1", loader, { ttl: 30, negativeTtl: 30 });
    await cache.getOrSet("test:neg", "key1", loader, { ttl: 30, negativeTtl: 30 });

    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("queryFingerprint", () => {
  it("is order-independent", () => {
    expect(queryFingerprint({ a: "1", b: "2" })).toBe(queryFingerprint({ b: "2", a: "1" }));
  });

  it("drops undefined and empty-string values", () => {
    expect(queryFingerprint({ a: "1", b: undefined, c: "" })).toBe(queryFingerprint({ a: "1" }));
  });

  it("hashes long fingerprints to a bounded size", () => {
    const long = queryFingerprint({ search: "x".repeat(500) });
    expect(long.length).toBeLessThan(20);
    expect(long.startsWith("h")).toBe(true);
  });
});
