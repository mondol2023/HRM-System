// src/modules/auth/auth.controller.ts
import type { CookieOptions, Request, Response } from "express";
import { authService } from "./auth.service";
import { env } from "../../config/env";
import { AppError } from "../../core/errors/AppError";
import { created, ok } from "../../core/http/apiResponse";
import type { AuthRequest } from "../../types";

const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";

const cookieOptions = (maxAgeSeconds: number, path = "/"): CookieOptions => {
  const options: CookieOptions = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.auth.cookieSameSite,
    maxAge: maxAgeSeconds * 1000,
    path,
  };
  if (env.auth.cookieDomain) options.domain = env.auth.cookieDomain;
  return options;
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(env.auth.accessTtlSeconds));
  // Scoped to the refresh endpoint so it is never sent on ordinary API calls.
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(env.auth.refreshTtlSeconds, "/api/v1/auth"));
};

const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
  res.clearCookie(REFRESH_COOKIE, cookieOptions(0, "/api/v1/auth"));
};

const readRefreshToken = (req: Request): string | undefined =>
  (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE] ??
  (req.body as { refreshToken?: string } | undefined)?.refreshToken;

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const { user, accessToken, refreshToken, expiresIn } = await authService.register(req.body);
    setAuthCookies(res, accessToken, refreshToken);
    // `token` is duplicated in the body for the existing frontend; cookies are
    // the primary transport.
    created(res, { user, token: accessToken, accessToken, refreshToken, expiresIn }, "Registration successful");
  },

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };
    const { user, accessToken, refreshToken, expiresIn } = await authService.login(email, password);
    setAuthCookies(res, accessToken, refreshToken);
    ok(res, { user, token: accessToken, accessToken, refreshToken, expiresIn }, "Login successful");
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const token = readRefreshToken(req);
    if (!token) throw AppError.unauthorized("Refresh token missing");

    const { accessToken, refreshToken, expiresIn } = await authService.refresh(token);
    setAuthCookies(res, accessToken, refreshToken);
    ok(res, { token: accessToken, accessToken, refreshToken, expiresIn }, "Token refreshed");
  },

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(readRefreshToken(req));
    clearAuthCookies(res);
    ok(res, null, "Logged out");
  },

  async getMe(req: AuthRequest, res: Response): Promise<void> {
    const user = await authService.getMe(req.user!.id);
    ok(res, user, "Profile fetched");
  },

  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    clearAuthCookies(res);
    ok(res, null, "Password changed — please sign in again");
  },
};
