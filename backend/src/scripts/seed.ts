// src/scripts/seed.ts
// One-off: creates the initial admin user if none exists. Run with `npm run seed`.
import { connectDB, closeDB } from "../config/db";
import { User } from "../modules/auth/user.model";
import { env } from "../config/env";
import { logger } from "../config/logger";

const run = async (): Promise<void> => {
  await connectDB();

  const existing = await User.findOne({ role: "admin" });
  if (existing) {
    logger.info("Admin already exists — skipping", { email: existing.email });
    return;
  }

  const admin = await User.create({
    name: env.seed.adminName,
    email: env.seed.adminEmail,
    password: env.seed.adminPassword,
    role: "admin",
  });

  logger.info("Admin created", { email: admin.email });
};

run()
  .catch((error: unknown) => {
    logger.error("Seed failed", { error: error instanceof Error ? error.message : error });
    process.exitCode = 1;
  })
  .finally(() => void closeDB());
