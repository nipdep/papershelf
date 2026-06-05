import { afterEach, describe, expect, it } from "vitest";

import { getAuthSecret, isConfiguredForGoogleAuth } from "@/lib/env";

const originalEnv = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  SYSTEM_OWNER_EMAIL: process.env.SYSTEM_OWNER_EMAIL
};

afterEach(() => {
  process.env.AUTH_SECRET = originalEnv.AUTH_SECRET;
  process.env.NEXTAUTH_SECRET = originalEnv.NEXTAUTH_SECRET;
  process.env.GOOGLE_CLIENT_ID = originalEnv.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = originalEnv.GOOGLE_CLIENT_SECRET;
  process.env.SYSTEM_OWNER_EMAIL = originalEnv.SYSTEM_OWNER_EMAIL;
});

describe("env helpers", () => {
  it("prefers AUTH_SECRET and falls back to NEXTAUTH_SECRET", () => {
    process.env.AUTH_SECRET = "";
    process.env.NEXTAUTH_SECRET = "nextauth-secret";

    expect(getAuthSecret()).toBe("nextauth-secret");

    process.env.AUTH_SECRET = "auth-secret";
    expect(getAuthSecret()).toBe("auth-secret");
  });

  it("treats either auth secret alias as valid app configuration", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.SYSTEM_OWNER_EMAIL = "owner@example.com";
    process.env.NEXTAUTH_SECRET = "nextauth-secret";
    process.env.AUTH_SECRET = "";

    expect(isConfiguredForGoogleAuth()).toBe(true);

    process.env.NEXTAUTH_SECRET = "";
    process.env.AUTH_SECRET = "auth-secret";
    expect(isConfiguredForGoogleAuth()).toBe(true);
  });
});
