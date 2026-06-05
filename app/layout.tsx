import Link from "next/link";
import { ReactNode } from "react";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";

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
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="eyebrow">Drive paper library</span>
              <strong>Papershelf</strong>
            </Link>
            <div className="row wrap">
              {session?.user?.email ? (
                <>
                  <span className="muted">
                    {session.user.email}
                    {session.user.isOwner ? " · owner" : ""}
                  </span>
                  {session.user.isOwner ? <Link href="/admin">Admin</Link> : null}
                  <SignOutButton />
                </>
              ) : (
                <span className="muted">Minimal UI, Drive-backed storage.</span>
              )}
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
