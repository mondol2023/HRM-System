// src/core/http/asyncHandler.ts
import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/** Express 4 does not catch rejected promises; without this a throw in an async handler hangs the request. */
export const asyncHandler =
  <Req extends Request = Request>(handler: AsyncRequestHandler<Req>): RequestHandler =>
  (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
