import Link from "next/link";

import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { LibraryCard } from "@/components/library-card";
import { isConfiguredForGoogleAuth } from "@/lib/env";
import { listLibrariesForSession } from "@/lib/server/library-service";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const globalQuery = params?.q?.trim().toLowerCase() ?? "";

  if (!isConfiguredForGoogleAuth()) {
    return (
      <main className="workspace hero-center">
        <section className="card hero-panel glass-card stack">
          <div className="title-cluster">
            <p className="eyebrow">Setup required</p>
            <h1>Papershelf needs Google OAuth before it can show libraries.</h1>
            <p>
              Add the documented Google and Auth.js environment variables, then sign in
              to index Drive-backed paper folders.
            </p>
          </div>
          <div className="notice card">
            <p className="muted">
              Required: <code className="inline-code">GOOGLE_CLIENT_ID</code>,{" "}
              <code className="inline-code">GOOGLE_CLIENT_SECRET</code>,{" "}
              <code className="inline-code">AUTH_SECRET</code> or{" "}
              <code className="inline-code">NEXTAUTH_SECRET</code>,{" "}
              <code className="inline-code">SYSTEM_OWNER_EMAIL</code>.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!session?.user?.email) {
    return (
      <main className="workspace hero-center">
        <section className="card hero-panel glass-card stack">
          <div className="title-cluster">
            <p className="eyebrow">Slick but practical</p>
            <h1>Browse and manage research papers directly from Google Drive.</h1>
            <p>
              Drive keeps the files, folders, and sharing model. Papershelf gives you a
              cleaner library view with search, indexing, and contextual file actions.
            </p>
          </div>
          <div className="metric-row">
            <div className="metric-pill">Drive-backed</div>
            <div className="metric-pill">Pane-based workspace</div>
            <div className="metric-pill">Library cache only</div>
          </div>
          <div className="hero-actions">
            <SignInButton />
          </div>
        </section>
      </main>
    );
  }

  if (session.user.authError) {
    return (
      <main className="workspace hero-center">
        <section className="card hero-panel glass-card stack">
          <div className="title-cluster">
            <p className="eyebrow">Session expired</p>
            <h1>Your Google connection needs to be refreshed.</h1>
            <p>
              The saved Google session is no longer valid, so Papershelf cannot read
              your Drive libraries until you sign in again.
            </p>
          </div>
          <div className="hero-actions">
            <SignInButton />
          </div>
        </section>
      </main>
    );
  }

  const libraries = await listLibrariesForSession(session);
  const accessibleLibraries = libraries
    .filter((library) => library.accessible)
    .filter((library) =>
      globalQuery
        ? [library.name, library.driveFolderId]
            .join(" ")
            .toLowerCase()
            .includes(globalQuery)
        : true
    );

  return (
    <main className="workspace">
      <header className="page-header">
        <div className="title-cluster">
          <p className="eyebrow">Libraries</p>
          <h1>Paper libraries</h1>
          <p>Select a library and work inside a Finder-style paper browser.</p>
        </div>
        {session.user.isOwner ? (
          <Link className="button button-secondary" href="/admin">
            Settings
          </Link>
        ) : null}
      </header>

      {libraries.length === 0 ? (
        <section className="card empty-panel">
          <p className="muted">
            {session.user.isOwner
              ? "No libraries yet. Add a Google Drive folder to begin."
              : "No paper libraries are configured for this app yet."}
          </p>
        </section>
      ) : globalQuery && accessibleLibraries.length === 0 ? (
        <section className="card empty-panel">
          <p className="muted">
            No libraries matched <code className="inline-code">{globalQuery}</code>.
          </p>
        </section>
      ) : accessibleLibraries.length === 0 ? (
        <section className="card empty-panel">
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
