import Image from "next/image";
import Link from "next/link";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { HeaderSearch } from "@/components/header-search";
import { asAppError } from "@/lib/errors";

import "./globals.css";

export const metadata: Metadata = {
  title: "Papershelf",
  description: "A very minimal Google Drive paper library.",
  icons: {
    icon: [{ url: "/favicon-32", sizes: "32x32", type: "image/png" }],
    shortcut: ["/favicon-32"],
    apple: [{ url: "/android-icon-192", sizes: "192x192", type: "image/png" }],
    other: [
      {
        rel: "icon",
        url: "/android-icon-192",
        sizes: "192x192",
        type: "image/png"
      }
    ]
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code !== "NOT_AUTHENTICATED") {
      throw appError;
    }
  }

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="app-frame">
            <header className="frame-header">
              <Link className="brand" href="/">
                <span className="brand-mark">
                  <Image
                    alt="Papershelf"
                    height={34}
                    priority
                    src="/android-icon-192"
                    width={34}
                  />
                </span>
                <span className="brand-copy">
                  <strong>Papershelf</strong>
                  <span>Drive-native paper library</span>
                </span>
              </Link>
              <HeaderSearch />
              <div className="header-right">
                {session?.user?.email ? (
                  <>
                    <span className="shell-badge">
                      {session.user.email}
                      {session.user.isOwner ? " · owner" : ""}
                    </span>
                    {session.user.isOwner ? (
                      <Link
                        aria-label="Settings"
                        className="shell-icon-button"
                        href="/settings"
                        title="Settings"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            d="M4 7h16v2H4V7Zm3 4h10v2H7v-2Zm-2 4h14v2H5v-2Z"
                            fill="currentColor"
                          />
                        </svg>
                      </Link>
                    ) : null}
                    <SignOutButton />
                  </>
                ) : (
                  <span className="shell-badge">Google Drive backed research library</span>
                )}
              </div>
            </header>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
