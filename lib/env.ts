import { z } from "zod";

const optionalString = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().min(1).optional()
  );

const envSchema = z.object({
  GOOGLE_CLIENT_ID: optionalString(),
  GOOGLE_CLIENT_SECRET: optionalString(),
  GOOGLE_API_KEY: optionalString(),
  AUTH_SECRET: optionalString(),
  NEXTAUTH_SECRET: optionalString(),
  AUTH_URL: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().url().optional()
  ),
  NEXTAUTH_URL: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().url().optional()
  ),
  SYSTEM_OWNER_EMAIL: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().email().optional()
  ),
  DEFAULT_LIBRARY_FOLDER_IDS: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().optional()
  )
});

type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    SYSTEM_OWNER_EMAIL: process.env.SYSTEM_OWNER_EMAIL,
    DEFAULT_LIBRARY_FOLDER_IDS: process.env.DEFAULT_LIBRARY_FOLDER_IDS
  });
}

export function getAuthSecret(): string | undefined {
  const env = getEnv();
  return env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
}

export function getAuthUrl(): string | undefined {
  const env = getEnv();
  return env.AUTH_URL ?? env.NEXTAUTH_URL;
}

export function isConfiguredForGoogleAuth(): boolean {
  const env = getEnv();
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      (env.AUTH_SECRET ?? env.NEXTAUTH_SECRET) &&
      env.SYSTEM_OWNER_EMAIL
  );
}

export function getGoogleApiKey(): string | undefined {
  return getEnv().GOOGLE_API_KEY;
}

export function isConfiguredForPublicDriveBrowsing(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_API_KEY && getDefaultLibraryFolderIds().length > 0);
}

export function isOwnerEmail(email?: string | null): boolean {
  const ownerEmail = getEnv().SYSTEM_OWNER_EMAIL?.toLowerCase();
  return Boolean(email && ownerEmail && email.toLowerCase() === ownerEmail);
}

export function getDefaultLibraryFolderIds(): string[] {
  return (getEnv().DEFAULT_LIBRARY_FOLDER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
