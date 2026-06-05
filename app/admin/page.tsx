import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import {
  addLibraryForOwner,
  listLibrariesForSession,
  rebuildLibraryIndex,
  removeLibraryForOwner
} from "@/lib/server/library-service";
import { requireOwner } from "@/lib/server/authz";

export default async function AdminPage() {
  const session = requireOwner(await auth());
  const libraries = await listLibrariesForSession(session);

  async function addLibraryAction(formData: FormData) {
    "use server";
    const currentSession = requireOwner(await auth());
    await addLibraryForOwner(currentSession, {
      driveFolderIdOrUrl: String(formData.get("driveFolderIdOrUrl") ?? ""),
      displayName: String(formData.get("displayName") ?? "")
    });
    revalidatePath("/");
    revalidatePath("/admin");
  }

  async function removeLibraryAction(formData: FormData) {
    "use server";
    const currentSession = requireOwner(await auth());
    await removeLibraryForOwner(currentSession, String(formData.get("libraryId") ?? ""));
    revalidatePath("/");
    revalidatePath("/admin");
  }

  async function rebuildLibraryAction(formData: FormData) {
    "use server";
    const currentSession = requireOwner(await auth());
    const libraryId = String(formData.get("libraryId") ?? "");
    await rebuildLibraryIndex(currentSession, libraryId);
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath(`/library/${libraryId}`);
  }

  if (!session.user.isOwner) {
    redirect("/");
  }

  return (
    <main className="pane-layout">
      <AppNav current="admin" isOwner={session.user.isOwner} />
      <section className="workspace">
        <header className="page-header">
          <div className="title-cluster">
            <p className="eyebrow">Admin mode</p>
            <h1>Instance settings</h1>
            <p>Manage Drive roots, rebuild indexes, and keep the workspace tidy.</p>
          </div>
          <Link className="button button-secondary" href="/">
            Back to libraries
          </Link>
        </header>

        <div className="settings-grid">
          <section className="section-panel">
            <section className="card glass-card">
              <div className="title-cluster">
                <p className="eyebrow">Owner</p>
                <h2>{session.user.email}</h2>
                <p>Production settings live here so library management stays off the main dashboard.</p>
              </div>
            </section>

            <section className="settings-list">
              {libraries.map((library) => (
                <article className="card settings-card" key={library.id}>
                  <div className="library-card-head">
                    <div className="stack-sm">
                      <p className="eyebrow">
                        {library.accessible ? "Accessible" : "Unavailable"}
                      </p>
                      <h2>{library.name}</h2>
                      <p className="muted">{library.driveFolderId}</p>
                    </div>
                    <span className={`status-chip ${library.canEdit ? "editable" : ""}`}>
                      {library.indexStatus}
                    </span>
                  </div>

                  <div className="info-grid">
                    <div className="info-row">
                      <label>Index state</label>
                      <span>
                        {library.generatedAt
                          ? `Last built ${new Date(library.generatedAt).toLocaleString()}`
                          : "No index yet"}
                      </span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <form action={rebuildLibraryAction}>
                      <input name="libraryId" type="hidden" value={library.driveFolderId} />
                      <button className="button button-secondary" type="submit">
                        Rebuild index
                      </button>
                    </form>
                    <a
                      className="button button-ghost"
                      href={`https://drive.google.com/drive/folders/${library.driveFolderId}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Drive folder
                    </a>
                    <form action={removeLibraryAction}>
                      <input name="libraryId" type="hidden" value={library.id} />
                      <button className="button button-danger" type="submit">
                        Remove
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </section>
          </section>

          <aside className="section-panel">
            <section className="card">
              <div className="title-cluster">
                <p className="eyebrow">Add library</p>
                <h2>New Drive root</h2>
                <p>Paste a folder URL or ID. This page acts as the dedicated settings surface.</p>
              </div>
              <form action={addLibraryAction} className="subtle-form">
                <div className="field">
                  <label htmlFor="driveFolderIdOrUrl">Drive folder URL or ID</label>
                  <input id="driveFolderIdOrUrl" name="driveFolderIdOrUrl" required />
                </div>
                <div className="field">
                  <label htmlFor="displayName">Display name</label>
                  <input id="displayName" name="displayName" />
                </div>
                <button className="button" type="submit">
                  Add to workspace
                </button>
              </form>
            </section>

            <section className="card">
              <div className="info-grid">
                <div className="info-row">
                  <label>Best practice</label>
                  <span>Keep each library root narrow and purposeful for faster rebuilds.</span>
                </div>
                <div className="info-row">
                  <label>Sync model</label>
                  <span>Drive stays authoritative. The SQLite file is only a rebuildable cache.</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
