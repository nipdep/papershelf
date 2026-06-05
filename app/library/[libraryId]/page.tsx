import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
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
  searchParams: Promise<{ folder?: string; q?: string }>;
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
        <main className="stack">
          <section className="toolbar">
            <div>
              <p className="eyebrow">Library</p>
              <h1 className="section-title">{library.name}</h1>
              <p className="muted">Index: missing</p>
            </div>
            <div className="row wrap">
              <Link href="/">Home</Link>
              {library.canEdit ? (
                <form action={rebuildAction}>
                  <button className="button" type="submit">
                    Rebuild index
                  </button>
                </form>
              ) : null}
            </div>
          </section>

          <section className="card stack">
            <div>
              <p className="eyebrow">Index missing</p>
              <h2>This library has not been indexed yet.</h2>
            </div>
            <p className="muted">
              Papershelf could access the Drive folder, but it did not find
              `.paper-manager/index.sqlite` inside that library yet.
            </p>
            {library.canEdit ? (
              <div className="row wrap">
                <form action={rebuildAction}>
                  <button className="button" type="submit">
                    Build index now
                  </button>
                </form>
                <a
                  href={`https://drive.google.com/drive/folders/${library.driveFolderId}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open Drive folder
                </a>
              </div>
            ) : (
              <p className="muted">
                Ask a library editor to run a rebuild from this page or the admin page.
              </p>
            )}
          </section>
        </main>
      );
    }

    throw error;
  }

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

  return (
    <main className="stack">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="section-title">{library.name}</h1>
          <p className="muted">
            Index: {library.indexStatus}
            {index.generatedAt ? ` · ${new Date(index.generatedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="row wrap">
          <Link href="/">Home</Link>
          {library.canEdit ? (
            <form action={rebuildAction}>
              <button className="button button-secondary" type="submit">
                Rebuild index
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="card">
        <form className="toolbar" method="get">
          <input name="folder" type="hidden" value={folderId} />
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="q">Search</label>
            <input defaultValue={query} id="q" name="q" placeholder="title, filename, path" />
          </div>
          <div className="row wrap">
            <button className="button button-secondary" type="submit">
              Search
            </button>
            <Link className="button button-secondary" href={`/library/${libraryId}`}>
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="library-layout">
        <aside className="sidebar">
          <FolderTree
            currentFolderId={folderId}
            folders={index.folders}
            libraryId={libraryId}
          />

          {library.canEdit ? (
            <>
              <form action={createFolderAction} className="card stack-sm">
                <h2>Create folder</h2>
                <input name="parentFolderId" type="hidden" value={folderId} />
                <div className="field">
                  <label htmlFor="name">Folder name</label>
                  <input id="name" name="name" required />
                </div>
                <button className="button" type="submit">
                  Create
                </button>
              </form>

              <form action={uploadAction} className="card stack-sm">
                <h2>Upload PDF</h2>
                <input name="parentFolderId" type="hidden" value={folderId} />
                <div className="field">
                  <label htmlFor="file">PDF file</label>
                  <input accept=".pdf,application/pdf" id="file" name="file" required type="file" />
                </div>
                <button className="button" type="submit">
                  Upload
                </button>
              </form>
            </>
          ) : null}
        </aside>

        <section className="stack">
          <PaperTable canEdit={library.canEdit} libraryId={libraryId} papers={visiblePapers} />

          {library.canEdit ? (
            <section className="card stack">
              <h2>Edit paper</h2>
              <form action={updatePaperAction} className="stack-sm">
                <div className="field">
                  <label htmlFor="driveFileId">Drive file ID</label>
                  <input id="driveFileId" name="driveFileId" required />
                </div>
                <div className="field">
                  <label htmlFor="fileName">New filename</label>
                  <input id="fileName" name="fileName" placeholder="Example Paper.pdf" />
                </div>
                <div className="field">
                  <label htmlFor="newParentFolderId">New parent folder ID</label>
                  <input id="newParentFolderId" name="newParentFolderId" />
                </div>
                <button className="button" type="submit">
                  Rename or move
                </button>
              </form>

              <form action={trashPaperAction} className="stack-sm">
                <div className="field">
                  <label htmlFor="trashDriveFileId">Drive file ID to trash</label>
                  <input id="trashDriveFileId" name="driveFileId" required />
                </div>
                <button className="button button-danger" type="submit">
                  Trash paper
                </button>
              </form>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
