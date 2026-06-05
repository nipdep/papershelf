import { describe, expect, it } from "vitest";

import { AppError, asAppError, isAppError } from "@/lib/errors";

describe("error helpers", () => {
  it("recognizes native AppError instances", () => {
    const error = new AppError("NOT_AUTHENTICATED", "Please sign in again.", 401);

    expect(isAppError(error)).toBe(true);
    expect(asAppError(error)).toBe(error);
  });

  it("normalizes app-shaped errors that lost their prototype", () => {
    const error = {
      name: "AppError",
      code: "NOT_AUTHENTICATED",
      status: 401,
      message: "Please sign in again."
    };

    const normalized = asAppError(error);
    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.code).toBe("NOT_AUTHENTICATED");
    expect(normalized.status).toBe(401);
  });
});
