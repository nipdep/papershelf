import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      email: string;
      isOwner: boolean;
      hasDriveAccess: boolean;
      accessToken?: string;
      drivePermissionId?: string;
      authError?: "RefreshAccessTokenError";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    refreshToken?: string;
    authError?: "RefreshAccessTokenError";
    isOwner?: boolean;
    hasDriveAccess?: boolean;
    drivePermissionId?: string;
    grantedScope?: string;
  }
}
