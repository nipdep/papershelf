import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";

import { auth } from "@/auth";
import { asAppError } from "@/lib/errors";
import { requireSession } from "@/lib/server/authz";

export default async function SettingsPage() {
  let session;
  try {
    session = requireSession(await auth());
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      redirect("/");
    }
    throw appError;
  }

  return (
    <main className="workspace">
      <header className="page-header">
        <div className="title-cluster">
          <p className="eyebrow">Settings</p>
          <h1>Workspace settings</h1>
          <p>Manage app-level options and jump into library administration when needed.</p>
        </div>
        <div className="mini-actions">
          <Link className="button button-secondary" href="/">
            Back to libraries
          </Link>
        </div>
      </header>

      <section className="settings-grid">
        <section className="section-panel">
          <article className="card settings-card">
            <div className="title-cluster">
              <p className="eyebrow">Workspace</p>
              <h2>View mode</h2>
              <p>Switch between split preview and no-split mode directly from the main content header.</p>
            </div>
            <p className="muted">
              Use the compact view-mode button in the collection header to change layout without leaving the explorer.
            </p>
          </article>

          {session.user.isOwner ? (
            <article className="card settings-card">
              <div className="title-cluster">
                <p className="eyebrow">Admin</p>
                <h2>Library administration</h2>
                <p>Add libraries, rebuild indexes, and manage configured Drive roots.</p>
              </div>
              <div className="card-actions">
                <Link className="button button-secondary" href="/admin">
                  Open library admin
                </Link>
              </div>
            </article>
          ) : null}

          <article className="card settings-card">
            <div className="title-cluster">
              <p className="eyebrow">Account</p>
              <h2>{session.user.email}</h2>
              <p>{session.user.isOwner ? "Owner access enabled." : "Standard library access."}</p>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
