import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
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
    <main className="stack">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Admin mode</p>
          <h1 className="section-title">Instance controls</h1>
        </div>
        <Link href="/">Back home</Link>
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Owner</p>
          <h2>{session.user.email}</h2>
        </div>
        <form action={addLibraryAction} className="stack">
          <div className="field">
            <label htmlFor="driveFolderIdOrUrl">Drive folder URL or ID</label>
            <input id="driveFolderIdOrUrl" name="driveFolderIdOrUrl" required />
          </div>
          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input id="displayName" name="displayName" />
          </div>
          <div>
            <button className="button" type="submit">
              Add library
            </button>
          </div>
        </form>
      </section>

      <section className="grid">
        {libraries.map((library) => (
          <article className="card stack-sm" key={library.id}>
            <div className="row wrap">
              <div className="stack-sm" style={{ flex: 1 }}>
                <p className="eyebrow">{library.accessible ? "Accessible" : "Unavailable"}</p>
                <h2>{library.name}</h2>
                <p className="muted">{library.driveFolderId}</p>
              </div>
              <a
                href={`https://drive.google.com/drive/folders/${library.driveFolderId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Drive
              </a>
            </div>
            <div className="row wrap">
              <form action={rebuildLibraryAction}>
                <input name="libraryId" type="hidden" value={library.driveFolderId} />
                <button className="button button-secondary" type="submit">
                  Rebuild index
                </button>
              </form>
              <form action={removeLibraryAction}>
                <input name="libraryId" type="hidden" value={library.id} />
                <button className="button button-danger" type="submit">
                  Remove from app
                </button>
              </form>
            </div>
            <p className="muted">
              Index: {library.indexStatus}
              {library.generatedAt ? ` · ${new Date(library.generatedAt).toLocaleString()}` : ""}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
