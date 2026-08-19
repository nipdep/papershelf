import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { ConnectDriveButton, SignInButton } from "@/components/auth-buttons";
import { CachedExplorer } from "@/components/cached-explorer";
import {
  isConfiguredForGoogleAuth,
  isConfiguredForPublicDriveBrowsing
} from "@/lib/env";
import { requireSession } from "@/lib/server/authz";
import {
  createSubfolder,
  rebuildLibraryIndex,
  trashFolderInLibrary,
  updateFolderMetadata,
  uploadPaper
} from "@/lib/server/library-service";


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

  const cacheCookieStore = await cookies();
  const cachedLayoutMode =
    cacheCookieStore.get("papershelf-layout")?.value === "list" ? "list" : "split";
  const browserCacheKey = signedInSession?.user.email
    ? `user:${signedInSession.user.email.toLowerCase()}`
    : "public";

  return (
    <CachedExplorer
      cacheKey={browserCacheKey}
      canManageLibraries={canManageLibraries}
      canRebuild={Boolean(signedInSession?.user.isOwner && signedInSession.user.hasDriveAccess)}
      createFolderAction={canManageLibraries ? createFolderAction : undefined}
      layoutMode={cachedLayoutMode}
      rebuildAction={rebuildAction}
      trashFolderAction={canManageLibraries ? trashFolderAction : undefined}
      updateFolderAction={canManageLibraries ? updateFolderAction : undefined}
      uploadAction={canManageLibraries ? uploadAction : undefined}
    />
  );

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

}
