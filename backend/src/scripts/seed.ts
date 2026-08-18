// src/scripts/seed.ts
// One-off: creates the initial admin user + default leave policy if none exist. Run with `npm run seed`.
import { connectDB, closeDB } from "../config/db";
import { User } from "../modules/auth/user.model";
import { LeaveType } from "../modules/leave/leaveType.model";
import { env } from "../config/env";
import { logger } from "../config/logger";

/** Typical SMB policy — all admin-editable afterward, this is just a sane starting point. */
const DEFAULT_LEAVE_TYPES = [
  { name: "Annual", code: "ANNUAL", accrualMethod: "monthly", defaultAnnualDays: 18, paid: true, requiresHRApproval: false },
  { name: "Sick", code: "SICK", accrualMethod: "monthly", defaultAnnualDays: 10, paid: true, requiresHRApproval: false },
  { name: "Casual", code: "CASUAL", accrualMethod: "monthly", defaultAnnualDays: 6, paid: true, requiresHRApproval: false },
  { name: "Unpaid", code: "UNPAID", accrualMethod: "fixed", defaultAnnualDays: 0, paid: false, tracksBalance: false, requiresHRApproval: true },
  { name: "Maternity", code: "MATERNITY", accrualMethod: "fixed", defaultAnnualDays: 112, paid: true, requiresHRApproval: true },
  { name: "Paternity", code: "PATERNITY", accrualMethod: "fixed", defaultAnnualDays: 10, paid: true, requiresHRApproval: true },
];

const seedAdmin = async (): Promise<void> => {
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

const seedLeaveTypes = async (): Promise<void> => {
  if (await LeaveType.exists({})) {
    logger.info("Leave types already exist — skipping");
    return;
  }

  await LeaveType.insertMany(DEFAULT_LEAVE_TYPES);
  logger.info("Default leave types created", { count: DEFAULT_LEAVE_TYPES.length });
};

const run = async (): Promise<void> => {
  await connectDB();
  await seedAdmin();
  await seedLeaveTypes();
};

run()
  .catch((error: unknown) => {
    logger.error("Seed failed", { error: error instanceof Error ? error.message : error });
    process.exitCode = 1;
  })
  .finally(() => void closeDB());
