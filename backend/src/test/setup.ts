// src/test/setup.ts
//
// Runs against real Mongo + Redis (no mongodb-memory-server): faster CI, and
// it catches driver/version quirks an in-memory fake would hide. Requires
// MONGO_URI and Redis reachable — see backendplan.md "Running tests".
import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import { env } from "../config/env";
import { connectRedis, closeRedis, getRedis } from "../config/redis";

// Never let a test run collide with a real dev/prod database.
const dbName = new URL(env.mongo.uri.replace(/^mongodb(\+srv)?/, "https")).pathname.slice(1);
if (!dbName.endsWith("-test")) {
  throw new Error("Refusing to run tests against a non-test MONGO_URI (database name must end in -test)");
}

beforeAll(async () => {
  await mongoose.connect(env.mongo.uri);
  await connectRedis(["cache", "limiter"]);
});

afterEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all(collections?.map((c) => c.deleteMany({})) ?? []);
  await getRedis("cache").flushdb();
});

afterAll(async () => {
  await mongoose.disconnect();
  await closeRedis();
});
