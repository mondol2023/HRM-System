// src/middleware/auth.middleware.ts
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, ITokenPayload, UserRole, AppError } from "../types";

export const authenticate = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    // Support both HTTP-only cookie and Bearer header
    const token: string | undefined =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : undefined);

    if (!token) throw new AppError("Authentication required", 401);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as ITokenPayload;

    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }
    next();
  };
};