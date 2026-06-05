import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";

import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { FolderTree } from "@/components/folder-tree";
import { PaperTable } from "@/components/paper-table";
import { ViewModeSwitcher } from "@/components/view-mode-switcher";
import { asAppError } from "@/lib/errors";
import { isConfiguredForGoogleAuth } from "@/lib/env";
import { ExplorerFolder } from "@/lib/models";
import { requireSession } from "@/lib/server/authz";
import {
  createSubfolder,
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
            <p>Sign in again to reconnect Papershelf to your Drive libraries.</p>
          </div>
          <div className="hero-actions">
            <SignInButton />
          </div>
        </section>
      </main>
    );
  }

  let explorer;
  try {
    explorer = await loadExplorerDataForSession(session);
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      redirect("/");
    }
    throw appError;
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
      <section className={`finder-layout ${layoutMode === "list" ? "finder-layout-list" : ""}`}>
        <aside className="finder-sidebar">
          <div className="pane-header finder-sidebar-header">
            <div className="pane-title">
              <strong>Libraries</strong>
              <span className="muted">
                {selectedFolder
                  ? `${selectedFolder.libraryName} · ${selectedFolder.name}`
                  : `${explorer.libraries.length} libraries · ${visiblePapers.length} papers`}
              </span>
            </div>
          </div>
          <FolderTree
            canEdit={true}
            createFolderAction={createFolderAction}
            currentFolderId={folderId}
            folders={explorer.folders}
            pageMode="root"
            query={globalQuery}
            rebuildAction={rebuildAction}
            trashFolderAction={trashFolderAction}
            updateFolderAction={updateFolderAction}
            uploadAction={uploadAction}
          />
        </aside>

        <section className="finder-main">
          <div className="finder-section-head">
            <div className="title-cluster">
              <p className="eyebrow">Collection</p>
              <h2>{selectedFolder ? selectedFolder.name : "All Libraries"}</h2>
              <p>
                {selectedFolder
                  ? `Showing papers from ${selectedFolder.libraryName} and this folder's descendants.`
                  : "Showing papers across all accessible libraries."}
                {globalQuery ? ` Filtered by "${globalQuery}".` : ""}
              </p>
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
