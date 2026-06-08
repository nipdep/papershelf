import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";

import { auth } from "@/auth";
import { ConnectDriveButton } from "@/components/auth-buttons";
import { getPublicCatalogFileId } from "@/lib/env";
import { asAppError } from "@/lib/errors";
import type { LibrarySummary } from "@/lib/models";
import {
  addLibraryForOwner,
  getDiscoveredPublicCatalogFileId,
  listLibrariesForSession,
  rebuildLibraryIndex,
  removeLibraryForOwner
} from "@/lib/server/library-service";
import { requireOwner, requireSession } from "@/lib/server/authz";

export default async function AdminPage() {
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

  let libraries: LibrarySummary[] = [];
  let discoveredPublicCatalogFileId: string | null = null;
  if (session.user.hasDriveAccess) {
    try {
      libraries = await listLibrariesForSession(session);
      if (session.user.isOwner) {
        discoveredPublicCatalogFileId = await getDiscoveredPublicCatalogFileId(session);
      }
    } catch (error) {
      unstable_rethrow(error);
      const appError = asAppError(error);
      if (appError.code === "NOT_AUTHENTICATED") {
        redirect("/");
      }
      throw appError;
    }
  }
  const configuredPublicCatalogFileId = getPublicCatalogFileId();

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
    const currentSession = requireSession(await auth());
    const libraryId = String(formData.get("libraryId") ?? "");
    await rebuildLibraryIndex(currentSession, libraryId);
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath(`/library/${libraryId}`);
  }

  return (
    <main className="workspace">
      <header className="page-header">
        <div className="title-cluster">
          <p className="eyebrow">Indexing</p>
          <h1>Library indexing</h1>
          <p>Rebuild indexes for the libraries you can edit in Drive.</p>
        </div>
        <Link className="button button-secondary" href="/">
          Back to libraries
        </Link>
      </header>

      {!session.user.hasDriveAccess ? (
        <section className="card glass-card stack">
          <div className="title-cluster">
            <p className="eyebrow">Drive access required</p>
            <h2>Connect Google Drive for owner indexing</h2>
            <p className="muted">
              {session.user.isOwner
                ? "Regular viewers can browse from published index.sqlite files without Drive permissions. To add libraries, rebuild indexes, or manage folders, connect your owner account to Google Drive."
                : "This workspace now serves published index.sqlite files to viewers. Library administration still requires the owner to connect Google Drive."}
            </p>
          </div>
          <div className="hero-actions">
            {session.user.isOwner ? <ConnectDriveButton /> : null}
            <Link className="button button-secondary" href="/">
              Browse libraries
            </Link>
          </div>
        </section>
      ) : null}

      <div className="settings-grid">
        <section className="section-panel">
          {session.user.isOwner && session.user.hasDriveAccess && !configuredPublicCatalogFileId ? (
            <section className="card glass-card stack">
              <div className="title-cluster">
                <p className="eyebrow">Public bootstrap</p>
                <h2>Set `PUBLIC_CATALOG_FILE_ID` once</h2>
                <p className="muted">
                  Anonymous public browsing needs one stable catalog file ID. After you set it in
                  your environment and redeploy, the app will keep that catalog updated
                  automatically.
                </p>
              </div>
              <div className="field">
                <label htmlFor="publicCatalogFileId">Detected catalog file ID</label>
                <input
                  id="publicCatalogFileId"
                  readOnly
                  value={discoveredPublicCatalogFileId ?? "Run Rebuild index once to create it."}
                />
              </div>
            </section>
          ) : null}

          <section className="card glass-card">
            <div className="title-cluster">
              <p className="eyebrow">Account</p>
              <h2>{session.user.email}</h2>
              <p className="muted">
                {session.user.isOwner
                  ? "Owner access includes library registration and removal."
                  : "You can rebuild indexes where Drive gives you edit access."}
              </p>
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

                <div className="card-actions">
                  <form action={rebuildLibraryAction}>
                    <input name="libraryId" type="hidden" value={library.driveFolderId} />
                    <button
                      className="button button-secondary"
                      disabled={!library.canEdit && !session.user.isOwner}
                      type="submit"
                    >
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
                  {session.user.isOwner ? (
                    <form action={removeLibraryAction}>
                      <input name="libraryId" type="hidden" value={library.id} />
                      <button className="button button-danger" type="submit">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </section>

        {session.user.isOwner && session.user.hasDriveAccess ? (
          <aside className="section-panel">
            <section className="card">
              <div className="title-cluster">
                <p className="eyebrow">Add library</p>
                <h2>New Drive root</h2>
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
          </aside>
        ) : null}
      </div>
    </main>
  );
}
