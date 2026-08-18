// src/middleware/auth.middleware.ts
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { setContextUser } from "../core/context/requestContext";
import { AppError } from "../core/errors/AppError";
import { PRIVILEGED_ROLES, type UserRole } from "../constants/enums";
import type { AuthRequest, ITokenPayload } from "../types";

const extractToken = (req: AuthRequest): string | undefined => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = (req.cookies as Record<string, string> | undefined)?.["accessToken"];
  return cookie;
};

/**
 * Verification is deliberately zero-I/O: access tokens are short-lived (15m)
 * and revocation is handled on the refresh token, so authenticating a request
 * never touches Redis or Mongo.
 */
export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) return next(AppError.unauthorized());

  try {
    const decoded = jwt.verify(token, env.auth.accessSecret, {
      issuer: "hrm-api",
      audience: "hrm-client",
    }) as ITokenPayload & { typ?: string };

    // A refresh token must never be accepted as an access token.
    if (decoded.typ && decoded.typ !== "access") return next(AppError.unauthorized("Invalid token type"));

    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    setContextUser(decoded.id, decoded.role);
    next();
  } catch (error) {
    next(
      error instanceof jwt.TokenExpiredError
        ? new AppError("Token expired", 401, { code: "TOKEN_EXPIRED" })
        : AppError.unauthorized("Invalid token")
    );
  }
};

export const authorize =
  (...roles: UserRole[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };

/** admin + hr. */
export const authorizePrivileged = authorize(...PRIVILEGED_ROLES);

/** Populates `req.user` when a token is present, but never rejects. */
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  if (!extractToken(req)) return next();
  authenticate(req, _res, (error?: unknown) => next(error instanceof AppError ? undefined : error));
};
