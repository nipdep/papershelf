import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  canEditFromCapabilities,
  requireDriveAccess,
  requireOwner,
  requireSession
} from "@/lib/server/authz";

describe("authz helpers", () => {
  it("requires a session", () => {
    expect(() => requireSession(null)).toThrow(AppError);
  });

  it("rejects stale Google sessions", () => {
    expect(() =>
      requireSession({
        user: {
          email: "user@example.com",
          isOwner: true,
          hasDriveAccess: false,
          authError: "RefreshAccessTokenError"
        }
      } as any)
    ).toThrow(AppError);
  });

  it("requires owner role", () => {
    expect(() =>
      requireOwner({
        user: {
          email: "user@example.com",
          isOwner: false,
          hasDriveAccess: false
        }
      } as any)
    ).toThrow(AppError);
  });

  it("requires drive access for Drive-backed actions", () => {
    expect(() =>
      requireDriveAccess({
        user: {
          email: "user@example.com",
          isOwner: true,
          hasDriveAccess: false
        }
      } as any)
    ).toThrow(AppError);
  });

  it("detects edit capabilities", () => {
    expect(canEditFromCapabilities({ canRename: true })).toBe(true);
    expect(canEditFromCapabilities({})).toBe(false);
  });
});
