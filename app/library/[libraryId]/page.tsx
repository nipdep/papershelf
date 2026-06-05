import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { FolderTree } from "@/components/folder-tree";
import { PaperTable } from "@/components/paper-table";
import { AppError } from "@/lib/errors";
import {
  createSubfolder,
  getLibraryIndex,
  listLibrariesForSession,
  rebuildLibraryIndex,
  trashPaperInLibrary,
  updatePaperMetadata,
  uploadPaper
} from "@/lib/server/library-service";
import { requireSession } from "@/lib/server/authz";

export default async function LibraryPage({
  params,
  searchParams
}: {
  params: Promise<{ libraryId: string }>;
  searchParams: Promise<{ folder?: string; q?: string; paper?: string }>;
}) {
  const session = requireSession(await auth());
  const { libraryId } = await params;
  const filters = await searchParams;

  const libraries = await listLibrariesForSession(session);
  const library = libraries.find((entry) => entry.driveFolderId === libraryId);
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
    if (error instanceof AppError && error.code === "INDEX_NOT_FOUND") {
      return (
        <main className="pane-layout">
          <AppNav current="library" isOwner={session.user.isOwner} />
          <section className="workspace">
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
          </section>
        </main>
      );
    }

    throw error;
  }

  const selectedFolder =
    index.folders.find((folder) => folder.driveFolderId === folderId) ?? index.folders[0];

  const visiblePapers = index.papers.filter((paper) => {
    const matchesFolder = folderId ? paper.driveFolderId === folderId : true;
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

  return (
    <main className="pane-layout">
      <AppNav current="library" isOwner={session.user.isOwner} />
      <section className="workspace">
        <header className="page-header">
          <div className="title-cluster">
            <p className="eyebrow">Library</p>
            <h1>{library.name}</h1>
            <p>
              {visiblePapers.length} visible paper{visiblePapers.length === 1 ? "" : "s"} ·
              {index.generatedAt
                ? ` indexed ${new Date(index.generatedAt).toLocaleString()}`
                : " index unavailable"}
            </p>
          </div>
          <div className="mini-actions">
            <Link className="button button-secondary" href="/">
              Libraries
            </Link>
            {library.canEdit ? (
              <form action={rebuildAction}>
                <button className="button button-secondary" type="submit">
                  Refresh index
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <section className="toolbar">
          <form className="toolbar-search" method="get">
            <input name="folder" type="hidden" value={folderId} />
            <span className="muted">Search</span>
            <input defaultValue={query} name="q" placeholder="title, filename, path" />
          </form>
          <div className="mini-actions">
            <Link className="button button-ghost" href={`/library/${libraryId}`}>
              Reset view
            </Link>
            {library.webViewLink ? (
              <a
                className="button button-ghost"
                href={library.webViewLink}
                rel="noreferrer"
                target="_blank"
              >
                Open root in Drive
              </a>
            ) : null}
          </div>
        </section>

        <section className="split-library">
          <aside className="pane">
            <div className="pane-header">
              <div className="pane-title">
                <strong>Folders</strong>
                <span className="muted">Browse by hierarchy</span>
              </div>
            </div>
            <FolderTree
              currentFolderId={folderId}
              folders={index.folders}
              libraryId={libraryId}
            />
          </aside>

          <section className="stack-sm">
            <PaperTable
              canEdit={library.canEdit}
              libraryId={libraryId}
              papers={visiblePapers}
              selectedPaperId={selectedPaper?.driveFileId}
            />
          </section>

          <aside className="pane">
            {selectedPaper ? (
              <div className="inspector-card">
                <div className="pane-header">
                  <div className="pane-title">
                    <strong>{selectedPaper.title}</strong>
                    <span className="muted">{selectedPaper.fileName}</span>
                  </div>
                </div>

                <div className="info-grid">
                  <div className="info-row">
                    <label>Path</label>
                    <span>{selectedPaper.path}</span>
                  </div>
                  <div className="info-row">
                    <label>Drive file ID</label>
                    <span>{selectedPaper.driveFileId}</span>
                  </div>
                  <div className="info-row">
                    <label>Folder</label>
                    <span>{selectedFolder?.name ?? "Library root"}</span>
                  </div>
                  <div className="info-row">
                    <label>Modified</label>
                    <span>
                      {selectedPaper.modifiedTime
                        ? new Date(selectedPaper.modifiedTime).toLocaleString()
                        : "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="inspector-actions">
                  <Link
                    className="button"
                    href={`/library/${libraryId}/paper/${selectedPaper.driveFileId}`}
                  >
                    Open preview
                  </Link>
                  {selectedPaper.webViewLink ? (
                    <a
                      className="button button-secondary"
                      href={selectedPaper.webViewLink}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Drive
                    </a>
                  ) : null}
                </div>

                {library.canEdit ? (
                  <>
                    <div className="quiet-divider" />
                    <form action={updatePaperAction} className="subtle-form">
                      <div className="title-cluster">
                        <p className="eyebrow">Rename or move</p>
                        <h2>File actions</h2>
                      </div>
                      <input name="driveFileId" type="hidden" value={selectedPaper.driveFileId} />
                      <div className="field">
                        <label htmlFor="fileName">New filename</label>
                        <input
                          defaultValue={selectedPaper.fileName}
                          id="fileName"
                          name="fileName"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="newParentFolderId">New parent folder ID</label>
                        <input id="newParentFolderId" name="newParentFolderId" />
                      </div>
                      <button className="button button-secondary" type="submit">
                        Save changes
                      </button>
                    </form>

                    <form action={trashPaperAction} className="subtle-form">
                      <input name="driveFileId" type="hidden" value={selectedPaper.driveFileId} />
                      <button className="button button-danger" type="submit">
                        Move to trash
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="inspector-empty">
                <div className="pane-title">
                  <strong>Inspector</strong>
                  <span className="muted">Select a paper from the center list.</span>
                </div>
              </div>
            )}

            {library.canEdit ? (
              <>
                <div className="quiet-divider" />
                <form action={createFolderAction} className="subtle-form">
                  <div className="title-cluster">
                    <p className="eyebrow">Selected folder</p>
                    <h2>{selectedFolder?.name ?? "Library root"}</h2>
                    <p>Create folders or upload PDFs into the current location.</p>
                  </div>
                  <input name="parentFolderId" type="hidden" value={folderId} />
                  <div className="field">
                    <label htmlFor="name">New folder name</label>
                    <input id="name" name="name" required />
                  </div>
                  <button className="button button-secondary" type="submit">
                    Create folder
                  </button>
                </form>

                <form action={uploadAction} className="subtle-form">
                  <input name="parentFolderId" type="hidden" value={folderId} />
                  <div className="field">
                    <label htmlFor="file">Upload PDF</label>
                    <input accept=".pdf,application/pdf" id="file" name="file" required type="file" />
                  </div>
                  <button className="button button-secondary" type="submit">
                    Upload into folder
                  </button>
                </form>
              </>
            ) : null}
          </aside>
        </section>
      </section>
    </main>
  );
}
