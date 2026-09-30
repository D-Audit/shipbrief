import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "ROUTE_NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
}

/**
 * The only place errors become HTTP responses. Known errors keep their code
 * and message; everything else is logged with the request id and returned as
 * a generic INTERNAL_ERROR — no stack traces, SQL or provider details leak.
 */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    logger.error({ err: error, requestId: req.id }, "Error after response started");
    return;
  }

  let appError: AppError | undefined;
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof multer.MulterError) {
    appError = new AppError(
      400,
      error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
      error.code === "LIMIT_FILE_SIZE" ? "That file is too large." : "The upload could not be processed.",
    );
  } else if (isBodyParserError(error)) {
    appError = new AppError(error.status ?? 400, error.type === "entity.too.large" ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
      error.type === "entity.too.large" ? "The request body is too large." : "The request body is not valid JSON.");
  }

  if (appError) {
    if (appError.status >= 500) logger.error({ err: error, requestId: req.id, code: appError.code }, appError.message);
    res.status(appError.status).json({
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined ? { details: appError.details } : {}),
      },
      requestId: req.id,
    });
    return;
  }

  logger.error({ err: error, requestId: req.id, method: req.method, path: req.path }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." },
    requestId: req.id,
  });
}

/** express.json() errors carry a `type` such as "entity.parse.failed" or "entity.too.large". */
function isBodyParserError(error: unknown): error is { type: string; status?: number } {
  const type = typeof error === "object" && error !== null ? (error as { type?: unknown }).type : undefined;
  return typeof type === "string" && type.startsWith("entity.");
}
