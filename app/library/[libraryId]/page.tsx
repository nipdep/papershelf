import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";

import { auth } from "@/auth";
import { FolderTree } from "@/components/folder-tree";
import { PaperTable } from "@/components/paper-table";
import { asAppError } from "@/lib/errors";
import {
  createSubfolder,
  getLibrarySummaryForSession,
  getLibraryIndex,
  rebuildLibraryIndex,
  trashPaperInLibrary,
  updatePaperMetadata,
  uploadPaper
} from "@/lib/server/library-service";
import { requireSession } from "@/lib/server/authz";

function previewUrlForPaper(driveFileId: string) {
  return `https://drive.google.com/file/d/${driveFileId}/preview`;
}

export default async function LibraryPage({
  params,
  searchParams
}: {
  params: Promise<{ libraryId: string }>;
  searchParams: Promise<{ folder?: string; q?: string; paper?: string }>;
}) {
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
  const { libraryId } = await params;
  const filters = await searchParams;

  let library;
  try {
    library = await getLibrarySummaryForSession(session, libraryId);
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      redirect("/");
    }
    throw appError;
  }
  if (!library?.accessible) {
    notFound();
  }

  const folderId = filters.folder ?? libraryId;
  const selectedPaperId = filters.paper;
  const query = filters.q?.trim() ?? "";

  async function rebuildAction() {
    "use server";
    const currentSession = requireSession(await auth());
    await rebuildLibraryIndex(currentSession, libraryId);
    revalidatePath(`/library/${libraryId}`);
    revalidatePath("/");
  }

  async function createFolderAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    await createSubfolder(currentSession, {
      libraryId,
      parentFolderId: String(formData.get("parentFolderId") ?? libraryId),
      name: String(formData.get("name") ?? "")
    });
    revalidatePath(`/library/${libraryId}`);
  }

  async function uploadAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
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
    revalidatePath(`/library/${libraryId}`);
  }

  async function updatePaperAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    await updatePaperMetadata(currentSession, {
      libraryId,
      driveFileId: String(formData.get("driveFileId") ?? ""),
      fileName: String(formData.get("fileName") ?? ""),
      newParentFolderId: String(formData.get("newParentFolderId") ?? "")
    });
    revalidatePath(`/library/${libraryId}`);
  }

  async function trashPaperAction(formData: FormData) {
    "use server";
    const currentSession = requireSession(await auth());
    await trashPaperInLibrary(currentSession, {
      libraryId,
      driveFileId: String(formData.get("driveFileId") ?? ""),
      confirm: true
    });
    revalidatePath(`/library/${libraryId}`);
  }

  let index;
  try {
    index = await getLibraryIndex(session, libraryId);
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      redirect("/");
    }
    if (appError.code === "INDEX_NOT_FOUND") {
      return (
        <main className="workspace">
            <header className="page-header">
              <div className="title-cluster">
                <p className="eyebrow">Library</p>
                <h1>{library.name}</h1>
                <p>The Drive root is connected, but the paper index file is still missing.</p>
              </div>
              <div className="mini-actions">
                <Link className="button button-secondary" href="/">
                  Back to libraries
                </Link>
                {library.canEdit ? (
                  <form action={rebuildAction}>
                    <button className="button" type="submit">
                      Build index now
                    </button>
                  </form>
                ) : null}
              </div>
            </header>

            <section className="card glass-card stack">
              <div className="title-cluster">
                <p className="eyebrow">Index missing</p>
                <h2>This library has not been indexed yet.</h2>
              </div>
              <p className="muted">
                Papershelf could access the Drive folder, but it did not find
                <code className="inline-code">.paper-manager/index.sqlite</code> in that
                library.
              </p>
              {library.canEdit ? (
                <div className="card-actions">
                  <form action={rebuildAction}>
                    <button className="button" type="submit">
                      Rebuild index
                    </button>
                  </form>
                  <a
                    className="button button-secondary"
                    href={`https://drive.google.com/drive/folders/${library.driveFolderId}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Drive folder
                  </a>
                </div>
              ) : (
                <p className="muted">
                  Ask a library editor to run a rebuild from this page or the settings page.
                </p>
              )}
            </section>
        </main>
      );
    }

    throw appError;
  }

  const selectedFolder =
    index.folders.find((folder) => folder.driveFolderId === folderId) ?? index.folders[0];

  const visibleFolderIds = new Set(
    selectedFolder
      ? index.folders
          .filter(
            (folder) =>
              folder.path === selectedFolder.path ||
              folder.path.startsWith(`${selectedFolder.path}/`)
          )
          .map((folder) => folder.driveFolderId)
      : index.folders.map((folder) => folder.driveFolderId)
  );

  const visiblePapers = index.papers.filter((paper) => {
    const matchesFolder = visibleFolderIds.has(paper.driveFolderId);
    const matchesQuery = query
      ? [paper.title, paper.fileName, paper.path]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      : true;
    return matchesFolder && matchesQuery;
  });

  const selectedPaper =
    visiblePapers.find((paper) => paper.driveFileId === selectedPaperId) ??
    index.papers.find((paper) => paper.driveFileId === selectedPaperId) ??
    visiblePapers[0];

  const folderOptions = index.folders.map((folder) => ({
    value: folder.driveFolderId,
    label: folder.depth === 0 ? library.name : `${"  ".repeat(folder.depth)}${folder.name}`
  }));
  const rootFolder = index.folders.find((folder) => folder.parentFolderId === null);

  return (
    <main className="workspace workspace-finder">
      <section className="finder-layout">
        <aside className="finder-sidebar">
          <div className="pane-header finder-sidebar-header">
            <div className="finder-root-row">
              {library.canEdit ? (
                <details className="menu">
                  <summary aria-label="Library actions" title="Library actions">
                    +
                  </summary>
                  <div className="menu-popover menu-popover-wide">
                    <form action={createFolderAction}>
                      <input name="parentFolderId" type="hidden" value={folderId} />
                      <input name="name" type="hidden" value="New Folder" />
                      <button className="menu-button" type="submit">
                        <span>New folder here</span>
                      </button>
                    </form>
                    <form action={uploadAction}>
                      <input name="parentFolderId" type="hidden" value={folderId} />
                      <label className="menu-file-picker">
                        <span>Upload PDF to current folder</span>
                        <input accept=".pdf,application/pdf" name="file" required type="file" />
                      </label>
                      <button className="menu-button" type="submit">
                        <span>Upload selected PDF</span>
                      </button>
                    </form>
                    <form action={rebuildAction}>
                      <button className="menu-button" type="submit">
                        <span>Refresh library index</span>
                      </button>
                    </form>
                    <Link className="menu-link" href="/">
                      <span>Back to libraries</span>
                    </Link>
                    {library.webViewLink ? (
                      <a
                        className="menu-link"
                        href={library.webViewLink}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <span>Open in Drive</span>
                      </a>
                    ) : null}
                  </div>
                </details>
              ) : null}
              <Link
                className={`tree-link tree-link-root ${folderId === libraryId ? "active" : ""}`}
                href={`/library/${libraryId}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
              >
                <span className="tree-label">
                  <span className="tree-icon">▣</span>
                  <span>{rootFolder?.name ?? library.name}</span>
                </span>
              </Link>
            </div>
            <div className="pane-title">
              <strong>{library.name}</strong>
              <span className="muted">
                {selectedFolder?.name ?? library.name} · {visiblePapers.length} paper
                {visiblePapers.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <FolderTree
            currentFolderId={folderId}
            folders={index.folders}
            libraryId={libraryId}
            query={query}
          />
        </aside>

        <section className="finder-main">
          <div className="finder-section-head">
            <div className="title-cluster">
              <p className="eyebrow">Collection</p>
              <h2>{selectedFolder?.name ?? library.name}</h2>
              <p>
                Showing papers inside this folder and all nested folders.
                {query ? ` Filtered by "${query}".` : ""}
              </p>
            </div>
          </div>
          <PaperTable
            canEdit={library.canEdit}
            currentFolderId={folderId}
            libraryId={libraryId}
            papers={visiblePapers}
            query={query}
            selectedPaperId={selectedPaper?.driveFileId}
          />
        </section>

        <aside className="finder-preview">
          {selectedPaper ? (
            <div className="preview-shell">
              <div className="preview-header">
                <div className="preview-title">
                  <strong>{selectedPaper.title}</strong>
                  <span>{selectedPaper.fileName}</span>
                </div>
                <div className="mini-actions">
                  <Link
                    className="button button-secondary"
                    href={`/library/${libraryId}/paper/${selectedPaper.driveFileId}`}
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

              {library.canEdit ? (
                <details className="menu preview-actions">
                  <summary className="button button-ghost">File options</summary>
                  <div className="menu-popover menu-popover-wide">
                    <form action={updatePaperAction} className="stack-sm">
                      <input name="driveFileId" type="hidden" value={selectedPaper.driveFileId} />
                      <div className="field">
                        <label htmlFor="fileName">File name</label>
                        <input
                          defaultValue={selectedPaper.fileName}
                          id="fileName"
                          name="fileName"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="newParentFolderId">Move to folder</label>
                        <select
                          defaultValue={selectedPaper.driveFolderId}
                          id="newParentFolderId"
                          name="newParentFolderId"
                        >
                          {folderOptions.map((folder) => (
                            <option key={folder.value} value={folder.value}>
                              {folder.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="button button-secondary" type="submit">
                        Save changes
                      </button>
                    </form>
                    <form action={trashPaperAction}>
                      <input name="driveFileId" type="hidden" value={selectedPaper.driveFileId} />
                      <button className="menu-button danger" type="submit">
                        <span>Move to trash</span>
                      </button>
                    </form>
                  </div>
                </details>
              ) : null}
            </div>
          ) : (
            <div className="preview-empty">
              <strong>Preview</strong>
              <span className="muted">Select a paper from the list to preview it here.</span>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
