// src/modules/auth/auth.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../types";
import { authService } from "./auth.service";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await authService.register(req.body);
      res.cookie("accessToken", token, COOKIE_OPTIONS);
      res.status(201).json({ success: true, message: "Registered successfully", data: { user, token } });
    } catch (err) {
      next(err);
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const { user, token } = await authService.login(email, password);
      res.cookie("accessToken", token, COOKIE_OPTIONS);
      res.json({ success: true, message: "Login successful", data: { user, token } });
    } catch (err) {
      next(err);
    }
  }

  logout(_req: AuthRequest, res: Response): void {
    res.clearCookie("accessToken");
    res.json({ success: true, message: "Logged out successfully" });
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getMe(req.user!.id);
      res.json({ success: true, message: "User fetched", data: user });
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };
      await authService.changePassword(req.user!.id, currentPassword, newPassword);
      res.clearCookie("accessToken");
      res.json({ success: true, message: "Password changed. Please log in again." });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();