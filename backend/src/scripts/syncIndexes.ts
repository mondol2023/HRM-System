// src/scripts/syncIndexes.ts
// Explicit, deploy-time index build. `MONGO_AUTO_INDEX` stays off in production
// so this never happens implicitly on a hot collection. Run with `npm run indexes:sync`.
import { connectDB, closeDB } from "../config/db";
import { User } from "../modules/auth/user.model";
import { Employee } from "../modules/employee/employee.model";
import { AuditLog } from "../modules/audit/audit.model";
import { LeaveType } from "../modules/leave/leaveType.model";
import { LeaveBalance } from "../modules/leave/leaveBalance.model";
import { LeaveRequest } from "../modules/leave/leaveRequest.model";
import { logger } from "../config/logger";

const run = async (): Promise<void> => {
  await connectDB();

  for (const model of [User, Employee, AuditLog, LeaveType, LeaveBalance, LeaveRequest]) {
    await model.syncIndexes();
    logger.info(`Indexes synced: ${model.modelName}`);
  }
};

run()
  .catch((error: unknown) => {
    logger.error("Index sync failed", { error: error instanceof Error ? error.message : error });
    process.exitCode = 1;
  })
  .finally(() => void closeDB());
