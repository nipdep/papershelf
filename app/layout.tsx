import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { auth } from "@/auth";
import { AutoIndexTrigger } from "@/components/auto-index-trigger";
import { SignOutButton } from "@/components/auth-buttons";
import { HeaderSearch } from "@/components/header-search";
import { asAppError } from "@/lib/errors";
import { requireSession } from "@/lib/server/authz";
import { rebuildAccessibleLibraryIndexes } from "@/lib/server/library-service";

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

  async function rebuildIndexesAction() {
    "use server";
    const currentSession = requireSession(await auth());
    await rebuildAccessibleLibraryIndexes(currentSession);
    revalidatePath("/", "layout");
    revalidatePath("/admin");
  }

  return (
    <html lang="en">
      <body>
        <AutoIndexTrigger
          cacheKey={session?.user?.email ?? undefined}
          enabled={Boolean(session?.user?.hasDriveAccess)}
        />
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
                    {session.user.hasDriveAccess ? (
                      <form action={rebuildIndexesAction}>
                        <button
                          aria-label="Rebuild indexes"
                          className="shell-icon-button"
                          title="Rebuild indexes"
                          type="submit"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              d="M12 5a7 7 0 1 0 6.65 9.2h-1.6A5.5 5.5 0 1 1 15.9 8.1L13 11h7V4l-2.99 2.99A6.96 6.96 0 0 0 12 5Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </form>
                    ) : null}
                    {session.user.isOwner ? (
                      <Link
                        aria-label="Settings"
                        className="shell-icon-button"
                        href="/settings"
                        title="Settings"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.08 7.08 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.51.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                            fill="currentColor"
                          />
                        </svg>
                      </Link>
                    ) : (
                      <Link
                        aria-label="Settings"
                        className="shell-icon-button"
                        href="/settings"
                        title="Settings"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.08 7.08 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.51.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                            fill="currentColor"
                          />
                        </svg>
                      </Link>
                    )}
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
