export type AppErrorCode =
  | "NOT_AUTHENTICATED"
  | "NOT_OWNER"
  | "DRIVE_ACCESS_DENIED"
  | "DRIVE_NOT_FOUND"
  | "INDEX_NOT_FOUND"
  | "INDEX_STALE"
  | "INVALID_REQUEST"
  | "UPLOAD_FAILED"
  | "REBUILD_FAILED";

export class AppError extends Error {
  code: AppErrorCode;
  status: number;

  constructor(code: AppErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      "status" in error &&
      typeof error.status === "number" &&
      "message" in error &&
      typeof error.message === "string"
  );
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isAppError(error)) {
    return new AppError(error.code as AppErrorCode, error.message, error.status);
  }

  if (error instanceof Error) {
    return new AppError("INVALID_REQUEST", error.message, 500);
  }

  return new AppError("INVALID_REQUEST", "Unexpected application error.", 500);
}
