// src/modules/auth/auth.service.ts
import bcrypt from "bcryptjs";
import { User } from "./user.model";
import { tokenService, type TokenPair } from "./token.service";
import { AppError } from "../../core/errors/AppError";
import { cache } from "../../core/cache/cacheService";
import { CacheNamespace } from "../../constants/cacheKeys";
import { env } from "../../config/env";
import type { IUser } from "../../types";

/**
 * Compared against on unknown emails so a failed login costs the same time as a
 * successful one — otherwise response latency enumerates valid accounts.
 */
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", env.auth.bcryptRounds);

export interface AuthResult extends TokenPair {
  user: IUser;
}

export const authService = {
  async register(data: { name: string; email: string; password: string }): Promise<AuthResult> {
    // The unique index is the real guard; this is only for a friendlier message.
    const existing = await User.exists({ email: data.email });
    if (existing) throw AppError.conflict("Email already in use");

    // `role` is never taken from input — see auth.schema.ts.
    const user = await User.create({ ...data, role: "employee" });
    const tokens = await tokenService.issue(tokenService.buildPayload(user));
    return { user, ...tokens };
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await User.findOne({ email, isActive: true }).select("+password");

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw AppError.unauthorized("Invalid credentials");
    }

    if (!(await user.comparePassword(password))) throw AppError.unauthorized("Invalid credentials");

    const tokens = await tokenService.issue(tokenService.buildPayload(user));
    return { user, ...tokens };
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    return tokenService.rotate(refreshToken, async (userId) => {
      const user = await User.findOne({ _id: userId, isActive: true }).select("email role").lean();
      if (!user) throw AppError.unauthorized("Account is no longer active");
      return { id: userId, email: user.email, role: user.role };
    });
  },

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) await tokenService.revoke(refreshToken);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) throw AppError.notFound("User");
    if (!(await user.comparePassword(currentPassword))) {
      throw AppError.unauthorized("Current password is incorrect");
    }

    user.password = newPassword;
    await user.save();

    // Every existing session is now suspect.
    await tokenService.revokeAll(userId);
    await cache.invalidate(CacheNamespace.USER);
  },

  async getMe(userId: string): Promise<IUser> {
    const user = await cache.getOrSet(
      CacheNamespace.USER,
      userId,
      async () => User.findById(userId).lean<IUser | null>(),
      { ttl: env.cacheTtl.entity }
    );

    if (!user) throw AppError.notFound("User");
    return user;
  },
};
