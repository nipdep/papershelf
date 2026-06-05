import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
    jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
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
      }
      return session;
    }
  }
});
