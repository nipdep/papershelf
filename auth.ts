import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";

import { getAuthSecret, isConfiguredForGoogleAuth, isOwnerEmail } from "@/lib/env";

const providers = isConfiguredForGoogleAuth()
  ? [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
            scope: [
              "openid",
              "email",
              "profile",
              "https://www.googleapis.com/auth/drive",
              "https://www.googleapis.com/auth/drive.appdata"
            ].join(" ")
          }
        }
      })
    ]
  : [];

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpiresAt: undefined,
      authError: "RefreshAccessTokenError"
    };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken
      })
    });

    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
    };

    if (!response.ok || !refreshed.access_token || !refreshed.expires_in) {
      throw new Error(refreshed.error ?? "Failed to refresh Google access token.");
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      authError: undefined
    };
  } catch {
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpiresAt: undefined,
      authError: "RefreshAccessTokenError"
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  trustHost: true,
  providers,
  session: {
    strategy: "jwt"
  },
  logger: {
    error(error) {
      console.error("[auth]", error);
    }
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.accessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 60 * 60 * 1000;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.authError = undefined;
      } else if (
        typeof token.accessTokenExpiresAt === "number" &&
        Date.now() >= token.accessTokenExpiresAt - 60_000
      ) {
        token = await refreshGoogleAccessToken(token);
      }
      if (profile?.email) {
        token.isOwner = isOwnerEmail(profile.email);
      } else if (typeof token.email === "string") {
        token.isOwner = isOwnerEmail(token.email);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email ?? "";
        session.user.isOwner = Boolean(token.isOwner);
        session.user.accessToken =
          typeof token.accessToken === "string" ? token.accessToken : undefined;
        session.user.authError = token.authError;
      }
      return session;
    }
  }
});
