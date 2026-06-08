import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";

import { auth } from "@/auth";
import { ConnectDriveButton } from "@/components/auth-buttons";
import { FolderTree } from "@/components/folder-tree";
import { PaperTable } from "@/components/paper-table";
import { ViewModeSwitcher } from "@/components/view-mode-switcher";
import { asAppError } from "@/lib/errors";
import {
  isConfiguredForGoogleAuth,
  isConfiguredForPublicDriveBrowsing
} from "@/lib/env";
import { ExplorerFolder } from "@/lib/models";
import { requireSession } from "@/lib/server/authz";
import {
  createSubfolder,
  loadExplorerDataForPublicAccess,
  loadExplorerDataForSession,
  rebuildLibraryIndex,
  trashFolderInLibrary,
  updateFolderMetadata,
  uploadPaper
} from "@/lib/server/library-service";

function previewUrlForPaper(driveFileId: string) {
  return `https://drive.google.com/file/d/${driveFileId}/preview`;
}

function collectDescendantFolderIds(
  folders: ExplorerFolder[],
  rootFolderId?: string
): Set<string> {
  if (!rootFolderId) {
    return new Set(folders.map((folder) => folder.driveFolderId));
  }

  const byParent = new Map<string, string[]>();
  for (const folder of folders) {
    const key = folder.parentFolderId ?? "";
    const bucket = byParent.get(key) ?? [];
    bucket.push(folder.driveFolderId);
    byParent.set(key, bucket);
  }

  const visible = new Set<string>();
  const queue = [rootFolderId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visible.has(current)) {
      continue;
    }
    visible.add(current);
    for (const childId of byParent.get(current) ?? []) {
      queue.push(childId);
    }
  }

  return visible;
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ folder?: string; q?: string; paper?: string }>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const folderId = params?.folder;
  const selectedPaperId = params?.paper;
  const globalQuery = params?.q?.trim().toLowerCase() ?? "";
  const canBrowsePublicLibraries = isConfiguredForPublicDriveBrowsing();

  if (!isConfiguredForGoogleAuth() && !canBrowsePublicLibraries) {
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
        </section>
      </main>
    );
  }

  const hasValidSession = Boolean(session?.user?.email && !session?.user?.authError);
  const signedInSession = hasValidSession ? session! : null;
  const canManageLibraries = Boolean(signedInSession?.user.isOwner && signedInSession.user.hasDriveAccess);

  if (!hasValidSession && !canBrowsePublicLibraries) {
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
          <div className="hero-actions">
            <ConnectDriveButton label="Connect Google Drive" redirectTo="/" />
          </div>
        </section>
      </main>
    );
  }

  if (session?.user?.authError && !canBrowsePublicLibraries) {
    return (
      <main className="workspace hero-center">
        <section className="card hero-panel glass-card stack">
          <div className="title-cluster">
            <p className="eyebrow">Session expired</p>
            <h1>Your Google connection needs to be refreshed.</h1>
            <p>Sign in again to reconnect Papershelf to your Drive libraries.</p>
          </div>
          <div className="hero-actions">
            <ConnectDriveButton label="Reconnect Google Drive" redirectTo="/" />
          </div>
        </section>
      </main>
    );
  }

  if (signedInSession && !signedInSession.user.hasDriveAccess && !canBrowsePublicLibraries) {
    return (
      <main className="workspace hero-center">
        <section className="card hero-panel glass-card stack">
          <div className="title-cluster">
            <p className="eyebrow">Library unavailable</p>
            <h1>This session can sign in, but it cannot load library data yet.</h1>
            <p>
              Viewer mode needs public index access configured for this app. Otherwise,
              the owner needs to connect Google Drive and publish library indexes before
              viewers can browse.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button button-secondary" href="/settings">
              Open settings
            </Link>
          </div>
        </section>
      </main>
    );
  }

  let explorer;
  try {
    if (signedInSession?.user.hasDriveAccess) {
      explorer = await loadExplorerDataForSession(signedInSession);
    } else {
      explorer = await loadExplorerDataForPublicAccess();
    }
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      if (canBrowsePublicLibraries) {
        notFound();
      }
      redirect("/");
    }
    throw appError;
  }

  if (
    !hasValidSession &&
    (folderId || selectedPaperId) &&
    !explorer.folders.some((folder) => folder.driveFolderId === folderId) &&
    !explorer.papers.some((paper) => paper.driveFileId === selectedPaperId)
  ) {
    notFound();
  }

  const cookieStore = await cookies();
  const layoutMode = cookieStore.get("papershelf-layout")?.value === "list" ? "list" : "split";
  const visibleFolderIds = collectDescendantFolderIds(explorer.folders, folderId);
  const visiblePapers = explorer.papers.filter((paper) => {
    const matchesFolder = folderId ? visibleFolderIds.has(paper.driveFolderId) : true;
    const matchesQuery = globalQuery
      ? [paper.title, paper.fileName, paper.path, paper.libraryName]
          .join(" ")
          .toLowerCase()
          .includes(globalQuery)
      : true;
    return matchesFolder && matchesQuery;
  });
  const selectedFolder = folderId
    ? explorer.folders.find((folder) => folder.driveFolderId === folderId)
    : undefined;
  const selectedPaper = selectedPaperId
    ? visiblePapers.find((paper) => paper.driveFileId === selectedPaperId) ??
      explorer.papers.find((paper) => paper.driveFileId === selectedPaperId)
    : undefined;

  async function rebuildAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    await rebuildLibraryIndex(currentSession, String(formData.get("libraryId") ?? ""));
    revalidatePath("/");
  }

  async function createFolderAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    const libraryId = String(formData.get("libraryId") ?? "");
    await createSubfolder(currentSession, {
      libraryId,
      parentFolderId: String(formData.get("parentFolderId") ?? libraryId),
      name: String(formData.get("name") ?? "")
    });
    revalidatePath("/");
  }

  async function uploadAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    const libraryId = String(formData.get("libraryId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name) {
      throw new Error("A PDF file is required.");
    }
    await uploadPaper(currentSession, {
      libraryId,
      parentFolderId: String(formData.get("parentFolderId") ?? libraryId),
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      bytes: new Uint8Array(await file.arrayBuffer())
    });
    revalidatePath("/");
  }

  async function updateFolderAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    await updateFolderMetadata(currentSession, {
      libraryId: String(formData.get("libraryId") ?? ""),
      driveFolderId: String(formData.get("driveFolderId") ?? ""),
      name: String(formData.get("name") ?? ""),
      newParentFolderId: String(formData.get("newParentFolderId") ?? "")
    });
    revalidatePath("/");
  }

  async function trashFolderAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    await trashFolderInLibrary(currentSession, {
      libraryId: String(formData.get("libraryId") ?? ""),
      driveFolderId: String(formData.get("driveFolderId") ?? ""),
      confirm: true
    });
    revalidatePath("/");
  }

  return (
    <main className="workspace workspace-finder">
      {!canManageLibraries ? (
        <section className="card glass-card stack">
          <div className="title-cluster">
            <p className="eyebrow">
              {session?.user?.isOwner
                ? session?.user?.authError
                  ? "Reconnect Google Drive"
                  : "Connect Google Drive"
                : session?.user?.email
                  ? "See privately shared papers"
                  : "See privately shared papers"}
            </p>
            <h2>
              {session?.user?.isOwner
                ? "Connect Google Drive to rebuild and publish library indexes."
                : "Browse public papers below, then connect Google Drive to unlock papers shared just with you."}
            </h2>
            <p className="muted">
              {session?.user?.isOwner ? (
                <>
                  Owner sessions need Drive access to rebuild and publish library indexes.
                </>
              ) : (
                <>
                  Papers shared as <strong>Anyone with the link</strong> appear below right away.
                  After you connect Google Drive, Papershelf can also merge in papers and folders
                  shared privately with your Google account.
                </>
              )}
            </p>
          </div>
          {!session?.user?.isOwner ? (
            <div className="hero-actions">
              {session?.user?.isOwner ? (
                <ConnectDriveButton
                  label={session?.user?.authError ? "Reconnect Google Drive" : "Connect Google Drive"}
                  redirectTo="/"
                />
              ) : (
                <ConnectDriveButton
                  label={session?.user?.email ? "Connect Google Drive" : "Log in with Google Drive"}
                  redirectTo="/"
                />
              )}
            </div>
          ) : (
            <div className="hero-actions">
              <ConnectDriveButton
                label={session?.user?.authError ? "Reconnect Google Drive" : "Connect Google Drive"}
                redirectTo="/"
              />
            </div>
          )}
        </section>
      ) : null}
      <section className={`finder-layout ${layoutMode === "list" ? "finder-layout-list" : ""}`}>
        <aside className="finder-sidebar">
          <div className="pane-header finder-sidebar-header">
            <div className="pane-title">
              <p className="eyebrow finder-sidebar-eyebrow">Library</p>
            </div>
          </div>
          <FolderTree
            canEdit={canManageLibraries}
            createFolderAction={canManageLibraries ? createFolderAction : undefined}
            currentFolderId={folderId}
            folders={explorer.folders}
            pageMode="root"
            query={globalQuery}
            rebuildAction={signedInSession?.user.isOwner && signedInSession.user.hasDriveAccess ? rebuildAction : undefined}
            trashFolderAction={canManageLibraries ? trashFolderAction : undefined}
            updateFolderAction={canManageLibraries ? updateFolderAction : undefined}
            uploadAction={canManageLibraries ? uploadAction : undefined}
          />
        </aside>

        <section className="finder-main">
          <div className="finder-section-head">
            <div className="title-cluster">
              <p className="eyebrow">Collection</p>
              <h2>{selectedFolder ? selectedFolder.name : "All Libraries"}</h2>
            </div>
            <div className="mini-actions">
              <ViewModeSwitcher value={layoutMode} />
            </div>
          </div>

          <PaperTable
            canEdit={false}
            papers={visiblePapers}
            selectedPaperId={selectedPaper?.driveFileId}
            selectedFolderId={selectedFolder?.driveFolderId}
            showLibraryName={true}
            query={globalQuery}
            viewMode={layoutMode}
          />
        </section>

        {layoutMode === "split" ? (
          <aside className="finder-preview">
            {selectedPaper ? (
              <div className="preview-shell">
                <div className="preview-header">
                  <div className="preview-title">
                    <strong>{selectedPaper.title}</strong>
                    <span>
                      {selectedPaper.libraryName} · {selectedPaper.fileName}
                    </span>
                  </div>
                  <div className="mini-actions">
                    <Link
                      className="button button-secondary"
                      href={`/library/${selectedPaper.libraryId}/paper/${selectedPaper.driveFileId}`}
                    >
                      Open
                    </Link>
                    {selectedPaper.webViewLink ? (
                      <a
                        className="button button-ghost"
                        href={selectedPaper.webViewLink}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Drive
                      </a>
                    ) : null}
                  </div>
                </div>
                <iframe
                  className="preview-frame"
                  src={previewUrlForPaper(selectedPaper.driveFileId)}
                  title={selectedPaper.title}
                />
              </div>
            ) : (
              <div className="preview-empty">
                <strong>Preview</strong>
                <span className="muted">Select a paper from the list to preview it here.</span>
              </div>
            )}
          </aside>
        ) : null}
      </section>
    </main>
  );
}
