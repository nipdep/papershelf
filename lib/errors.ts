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
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError("INVALID_REQUEST", "Unexpected application error.", 500);
}
