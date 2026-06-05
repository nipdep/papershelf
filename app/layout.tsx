import Link from "next/link";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";
import { ReactNode } from "react";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { HeaderSearch } from "@/components/header-search";
import { asAppError } from "@/lib/errors";

import "./globals.css";

export const metadata = {
  title: "Papershelf",
  description: "A very minimal Google Drive paper library."
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
                <span className="brand-mark">PS</span>
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
                        href="/admin"
                        title="Settings"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            d="M19.14 12.94a7.96 7.96 0 0 0 .06-.94 7.96 7.96 0 0 0-.06-.94l2.03-1.58-1.92-3.32-2.39.96a7.28 7.28 0 0 0-1.63-.94L14.96 2h-3.92l-.27 2.18c-.58.22-1.12.53-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58a7.96 7.96 0 0 0-.06.94c0 .32.02.63.06.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.4 1.05.72 1.63.94l.27 2.18h3.92l.27-2.18c.58-.22 1.13-.54 1.63-.94l2.39.96 1.92-3.32-2.03-1.58ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
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
