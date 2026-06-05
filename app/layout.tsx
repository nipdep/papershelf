import Link from "next/link";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";
import { ReactNode } from "react";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
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
              <form action="/" className="header-search" method="get">
                <span className="header-search-icon">⌘K</span>
                <input name="q" placeholder="Search libraries and papers" />
              </form>
              <div className="header-right">
                {session?.user?.email ? (
                  <>
                    <span className="shell-badge">
                      {session.user.email}
                      {session.user.isOwner ? " · owner" : ""}
                    </span>
                    {session.user.isOwner ? (
                      <Link className="shell-link" href="/admin">
                        Settings
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
