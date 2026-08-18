// src/modules/auth/token.service.ts
//
// Access tokens are stateless and short-lived so authentication costs zero I/O.
// Refresh tokens are the revocable half: each one is recorded in Redis, rotated
// on every use, and a reuse attempt revokes the whole family.
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { getRedis } from "../../config/redis";
import { logger } from "../../config/logger";
import { authKeys } from "../../constants/cacheKeys";
import { AppError } from "../../core/errors/AppError";
import type { ITokenPayload, UserRole } from "../../types";

const ISSUER = "hrm-api";
const AUDIENCE = "hrm-client";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshClaims {
  id: string;
  jti: string;
  typ: "refresh";
}

const signAccess = (payload: ITokenPayload): string =>
  jwt.sign({ ...payload, typ: "access" }, env.auth.accessSecret, {
    expiresIn: env.auth.accessTtlSeconds,
    issuer: ISSUER,
    audience: AUDIENCE,
  });

const signRefresh = (userId: string, jti: string): string =>
  jwt.sign({ id: userId, jti, typ: "refresh" } satisfies RefreshClaims, env.auth.refreshSecret, {
    expiresIn: env.auth.refreshTtlSeconds,
    issuer: ISSUER,
    audience: AUDIENCE,
  });

export const tokenService = {
  async issue(payload: ITokenPayload): Promise<TokenPair> {
    const jti = randomUUID();
    const redis = getRedis("cache");

    try {
      // The user set lets us revoke every session at once on logout-all.
      await redis
        .multi()
        .set(authKeys.refreshToken(jti), payload.id, "EX", env.auth.refreshTtlSeconds)
        .sadd(authKeys.userTokenSet(payload.id), jti)
        .expire(authKeys.userTokenSet(payload.id), env.auth.refreshTtlSeconds)
        .exec();
    } catch (error) {
      // Refuse to hand out a token we cannot revoke.
      logger.error("Failed to persist refresh token", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw AppError.unavailable("Unable to establish a session, please retry");
    }

    return {
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload.id, jti),
      expiresIn: env.auth.accessTtlSeconds,
    };
  },

  /** Verifies, consumes, and replaces a refresh token. */
  async rotate(token: string, resolveUser: (id: string) => Promise<ITokenPayload>): Promise<TokenPair> {
    let claims: RefreshClaims;
    try {
      claims = jwt.verify(token, env.auth.refreshSecret, {
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as RefreshClaims;
    } catch {
      throw AppError.unauthorized("Invalid refresh token");
    }

    if (claims.typ !== "refresh") throw AppError.unauthorized("Invalid token type");

    const redis = getRedis("cache");
    // DEL returns 1 only for the caller that actually consumed it, so a
    // concurrent replay loses the race and is rejected.
    const consumed = await redis.del(authKeys.refreshToken(claims.jti));
    if (consumed !== 1) {
      // Replay of an already-used token: assume theft and kill every session.
      logger.warn("Refresh token reuse detected — revoking all sessions", { userId: claims.id });
      await tokenService.revokeAll(claims.id);
      throw AppError.unauthorized("Refresh token already used");
    }

    await redis.srem(authKeys.userTokenSet(claims.id), claims.jti);

    const payload = await resolveUser(claims.id);
    return tokenService.issue(payload);
  },

  async revoke(token: string): Promise<void> {
    try {
      const claims = jwt.verify(token, env.auth.refreshSecret, {
        issuer: ISSUER,
        audience: AUDIENCE,
        ignoreExpiration: true,
      }) as RefreshClaims;

      await getRedis("cache")
        .multi()
        .del(authKeys.refreshToken(claims.jti))
        .srem(authKeys.userTokenSet(claims.id), claims.jti)
        .exec();
    } catch {
      // Logging out with a bad token is not an error worth surfacing.
    }
  },

  /** Used on password change and on suspected token theft. */
  async revokeAll(userId: string): Promise<void> {
    const redis = getRedis("cache");
    try {
      const jtis = await redis.smembers(authKeys.userTokenSet(userId));
      if (jtis.length) await redis.del(...jtis.map(authKeys.refreshToken));
      await redis.del(authKeys.userTokenSet(userId));
    } catch (error) {
      logger.error("Failed to revoke sessions", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  buildPayload(user: { _id: { toString(): string }; email: string; role: UserRole }): ITokenPayload {
    return { id: user._id.toString(), email: user.email, role: user.role };
  },
};
