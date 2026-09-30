/**
 * Every expected failure is an AppError with a stable machine-readable code.
 * The error middleware turns these into the standard error envelope; anything
 * that is not an AppError becomes a generic 500 without internal details.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = "Sign in to continue.", code = "UNAUTHENTICATED") => new AppError(401, code, message);
export const forbidden = (message = "You don't have permission to do that.", code = "FORBIDDEN") => new AppError(403, code, message);
export const notFound = (code: string, message: string) => new AppError(404, code, message);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
export const unprocessable = (code: string, message: string, details?: unknown) => new AppError(422, code, message, details);
export const tooManyRequests = (message = "Too many requests. Please wait a moment and try again.", retryAfterSeconds?: number) =>
  new AppError(429, "RATE_LIMITED", message, retryAfterSeconds ? { retryAfterSeconds } : undefined);
export const notConfigured = (code: string, message: string) => new AppError(503, code, message);
export const upstreamError = (code: string, message: string) => new AppError(502, code, message);

export function isUniqueViolation(error: unknown, constraint?: string) {
  const pgError = findPgError(error);
  return pgError?.code === "23505" && (!constraint || pgError.constraint === constraint);
}

export function isForeignKeyViolation(error: unknown) {
  return findPgError(error)?.code === "23503";
}

/** Drizzle wraps driver errors; walk the cause chain to find the pg error. */
function findPgError(error: unknown): { code?: string; constraint?: string } | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current && typeof (current as { code: unknown }).code === "string") {
      return current as { code?: string; constraint?: string };
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}
