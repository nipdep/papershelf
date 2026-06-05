import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { canEditFromCapabilities, requireOwner, requireSession } from "@/lib/server/authz";

describe("authz helpers", () => {
  it("requires a session", () => {
    expect(() => requireSession(null)).toThrow(AppError);
  });

  it("requires owner role", () => {
    expect(() =>
      requireOwner({
        user: {
          email: "user@example.com",
          isOwner: false
        }
      } as any)
    ).toThrow(AppError);
  });

  it("detects edit capabilities", () => {
    expect(canEditFromCapabilities({ canRename: true })).toBe(true);
    expect(canEditFromCapabilities({})).toBe(false);
  });
});
