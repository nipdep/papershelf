import Link from "next/link";

import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { LibraryCard } from "@/components/library-card";
import { isConfiguredForGoogleAuth } from "@/lib/env";
import { listLibrariesForSession } from "@/lib/server/library-service";

export default async function HomePage() {
  const session = await auth();

  if (!isConfiguredForGoogleAuth()) {
    return (
      <main className="hero">
        <div className="hero-copy stack">
          <p className="eyebrow">Setup required</p>
          <h1>Papershelf needs Google OAuth before it can show libraries.</h1>
          <p className="muted">
            Add the documented Google and NextAuth environment variables, then sign in
            to index Drive-backed paper folders.
          </p>
          <div className="card notice">
            <p className="muted">
              Required: <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{" "}
              <code>NEXTAUTH_SECRET</code>, <code>SYSTEM_OWNER_EMAIL</code>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!session?.user?.email) {
    return (
      <main className="hero">
        <div className="hero-copy stack">
          <p className="eyebrow">Very minimalistic UI</p>
          <h1>Browse and manage research papers directly from Google Drive.</h1>
          <p className="muted">
            Google Drive stays the source of truth for files, folders, and sharing.
            Papershelf adds a small paper-focused index, search, and file-browser layer.
          </p>
          <div className="row">
            <SignInButton />
          </div>
        </div>
      </main>
    );
  }

  const libraries = await listLibrariesForSession(session);
  const accessibleLibraries = libraries.filter((library) => library.accessible);

  return (
    <main className="stack">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="section-title">Libraries</h1>
        </div>
        {session.user.isOwner ? <Link href="/admin">Open admin</Link> : null}
      </section>

      {libraries.length === 0 ? (
        <section className="card">
          <p className="muted">
            {session.user.isOwner
              ? "No libraries yet. Add a Google Drive folder to begin."
              : "No paper libraries are configured for this app yet."}
          </p>
        </section>
      ) : accessibleLibraries.length === 0 ? (
        <section className="card">
          <p className="muted">
            No accessible libraries found. Ask the library owner to share the Drive
            folder with your Google account.
          </p>
        </section>
      ) : (
        <section className="grid library-grid">
          {accessibleLibraries.map((library) => (
            <LibraryCard key={library.id} library={library} />
          ))}
        </section>
      )}
    </main>
  );
}
