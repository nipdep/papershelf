import { z } from "zod";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  SYSTEM_OWNER_EMAIL: z.string().email().optional(),
  DEFAULT_LIBRARY_FOLDER_IDS: z.string().optional()
});

type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    SYSTEM_OWNER_EMAIL: process.env.SYSTEM_OWNER_EMAIL,
    DEFAULT_LIBRARY_FOLDER_IDS: process.env.DEFAULT_LIBRARY_FOLDER_IDS
  });
}

export function isConfiguredForGoogleAuth(): boolean {
  const env = getEnv();
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.NEXTAUTH_SECRET &&
      env.SYSTEM_OWNER_EMAIL
  );
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
