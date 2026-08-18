// src/core/errors/AppError.ts

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * An error we deliberately produced and whose message is safe to return to the
 * caller. Anything that is *not* an AppError is treated as a bug by the error
 * middleware and its message is hidden in production.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;
  public readonly code: string | undefined;
  public readonly details: unknown;

  constructor(message: string, statusCode: number, options: { code?: string; details?: unknown } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, HttpStatus.BAD_REQUEST, { code: "BAD_REQUEST", details });
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(message, HttpStatus.UNAUTHORIZED, { code: "UNAUTHORIZED" });
  }

  static forbidden(message = "Insufficient permissions"): AppError {
    return new AppError(message, HttpStatus.FORBIDDEN, { code: "FORBIDDEN" });
  }

  static notFound(resource = "Resource"): AppError {
    return new AppError(`${resource} not found`, HttpStatus.NOT_FOUND, { code: "NOT_FOUND" });
  }

  static conflict(message: string): AppError {
    return new AppError(message, HttpStatus.CONFLICT, { code: "CONFLICT" });
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, HttpStatus.UNPROCESSABLE_ENTITY, { code: "VALIDATION_ERROR", details });
  }

  static tooManyRequests(message = "Too many requests"): AppError {
    return new AppError(message, HttpStatus.TOO_MANY_REQUESTS, { code: "RATE_LIMITED" });
  }

  static upstream(message: string): AppError {
    return new AppError(message, HttpStatus.BAD_GATEWAY, { code: "UPSTREAM_FAILURE" });
  }

  static unavailable(message = "Service temporarily unavailable"): AppError {
    return new AppError(message, HttpStatus.SERVICE_UNAVAILABLE, { code: "UNAVAILABLE" });
  }
}
