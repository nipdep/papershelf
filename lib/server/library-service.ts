import { Session } from "next-auth";

import { AppError } from "@/lib/errors";
import { getDefaultLibraryFolderIds } from "@/lib/env";
import {
  DriveClient,
  getDriveClientForSession,
  getPublicDriveClient
} from "@/lib/google/drive";
import { canEditFromCapabilities } from "@/lib/server/authz";
import {
  loadLibraryConfig,
  removeLibraryRecord,
  saveLibraryConfig,
  upsertLibraryRecord
} from "@/lib/server/library-config";
import { createIndexSqlite, parseIndexSqlite, searchIndexSqlite } from "@/lib/server/index-sqlite";
import { scanDriveLibrary } from "@/lib/server/scan-drive-library";
import {
  ExplorerFolder,
  ExplorerPaper,
  LibraryConfig,
  LibraryIndexData,
  LibrarySummary,
  PaperAccessLevel
} from "@/lib/models";
import { parseDriveFolderInput } from "@/lib/utils/drive";

export async function createSessionDriveClient(session: Session): Promise<DriveClient> {
  return getDriveClientForSession(session);
}

export async function createPublicDriveClient(): Promise<DriveClient> {
  return getPublicDriveClient();
}

async function createBrowsingDriveClient(session: Session | null): Promise<DriveClient> {
  return session?.user.hasDriveAccess
    ? createSessionDriveClient(session)
    : createPublicDriveClient();
}

function isPubliclyAccessiblePaper(accessLevel: PaperAccessLevel): boolean {
  return accessLevel === "anyone_with_link" || accessLevel === "public_on_web";
}

function filterIndexForPublicAccess(index: LibraryIndexData): LibraryIndexData | null {
  const papers = index.papers.filter((paper) => isPubliclyAccessiblePaper(paper.accessLevel));
  if (papers.length === 0) {
    return null;
  }

  const folderById = new Map(index.folders.map((folder) => [folder.driveFolderId, folder]));
  const visibleFolderIds = new Set<string>();

  for (const paper of papers) {
    let cursor = folderById.get(paper.driveFolderId);
    while (cursor && !visibleFolderIds.has(cursor.driveFolderId)) {
      visibleFolderIds.add(cursor.driveFolderId);
      cursor = cursor.parentFolderId ? folderById.get(cursor.parentFolderId) : undefined;
    }
  }

  const folders = index.folders.filter((folder) => visibleFolderIds.has(folder.driveFolderId));
  return {
    ...index,
    folders,
    papers
  };
}

async function summarizeLibrary(
  driveClient: DriveClient,
  library: LibraryConfig["libraries"][number]
): Promise<LibrarySummary> {
  try {
    const [metadata, indexFile] = await Promise.all([
      driveClient.getFileMetadata(library.driveFolderId),
      driveClient.getIndexFileMetadata(library.driveFolderId)
    ]);

    return {
      id: library.id,
      name: library.displayName ?? metadata.name,
      driveFolderId: library.driveFolderId,
      accessible: true,
      canEdit: canEditFromCapabilities(metadata.capabilities),
      canAddChildren: Boolean(metadata.capabilities?.canAddChildren),
      webViewLink: metadata.webViewLink,
      indexStatus: indexFile ? "ok" : "missing",
      generatedAt: library.cachedGeneratedAt ?? indexFile?.modifiedTime,
      paperCount: library.cachedPaperCount,
      folderCount: library.cachedFolderCount
    };
  } catch {
    return {
      id: library.id,
      name: library.displayName ?? library.driveFolderId,
      driveFolderId: library.driveFolderId,
      accessible: false,
      canEdit: false,
      canAddChildren: false,
      indexStatus: "error" as const
    };
  }
}

export async function listLibrariesForSession(session: Session): Promise<LibrarySummary[]> {
  const driveClient = await createSessionDriveClient(session);
  const config = await loadLibraryConfig(driveClient);

  const summaries = await Promise.all(config.libraries.map((library) => summarizeLibrary(driveClient, library)));

  return summaries;
}

export async function listPublicLibraries(): Promise<LibrarySummary[]> {
  const driveClient = await createPublicDriveClient();
  const defaults = getDefaultLibraryFolderIds();

  const summaries = await Promise.all(
    defaults.map((driveFolderId) =>
      summarizeLibrary(driveClient, {
        id: driveFolderId,
        driveFolderId,
        addedAt: new Date().toISOString()
      })
    )
  );

  return summaries.filter((library) => library.accessible);
}

export async function getLibrarySummaryForSession(
  session: Session,
  libraryId: string
): Promise<LibrarySummary | null> {
  const driveClient = await createSessionDriveClient(session);
  const config = await loadLibraryConfig(driveClient);
  const library = config.libraries.find((entry) => entry.driveFolderId === libraryId);

  if (!library) {
    return null;
  }

  return summarizeLibrary(driveClient, library);
}

export async function addLibraryForOwner(
  session: Session,
  input: { driveFolderIdOrUrl: string; displayName?: string }
) {
  const driveClient = await createSessionDriveClient(session);
  const driveFolderId = parseDriveFolderInput(input.driveFolderIdOrUrl);
  if (!driveFolderId) {
    throw new AppError("INVALID_REQUEST", "A Drive folder ID or URL is required.", 400);
  }

  const metadata = await driveClient.getFileMetadata(driveFolderId);
  await driveClient.ensurePaperManagerFolder(driveFolderId);

  const config = await loadLibraryConfig(driveClient);
  const nextConfig = upsertLibraryRecord(config, {
    id: driveFolderId,
    driveFolderId,
    displayName: input.displayName?.trim() || metadata.name
  });
  await saveLibraryConfig(driveClient, nextConfig);

  return nextConfig;
}

export async function removeLibraryForOwner(session: Session, libraryId: string) {
  const driveClient = await createSessionDriveClient(session);
  const config = await loadLibraryConfig(driveClient);
  const nextConfig = removeLibraryRecord(config, libraryId);
  await saveLibraryConfig(driveClient, nextConfig);
  return nextConfig;
}

export async function rebuildLibraryIndex(session: Session, libraryId: string) {
  const driveClient = await createSessionDriveClient(session);
  const metadata = await driveClient.getFileMetadata(libraryId);
  if (!canEditFromCapabilities(metadata.capabilities) && !session.user.isOwner) {
    throw new AppError(
      "DRIVE_ACCESS_DENIED",
      "You do not have edit access to rebuild this index.",
      403
    );
  }

  const scanResult = await scanDriveLibrary(driveClient, libraryId);
  const bytes = await createIndexSqlite(scanResult);
  const upload = await driveClient.uploadOrUpdateIndexSqlite(libraryId, bytes);
  const generatedAt = new Date().toISOString();
  const config = await loadLibraryConfig(driveClient);
  const nextConfig = upsertLibraryRecord(config, {
    id: libraryId,
    driveFolderId: libraryId,
    displayName: metadata.name,
    cachedPaperCount: scanResult.papers.length,
    cachedFolderCount: scanResult.folders.length,
    cachedGeneratedAt: generatedAt
  });
  await saveLibraryConfig(driveClient, nextConfig);

  return {
    ok: true,
    foldersIndexed: scanResult.folders.length,
    papersIndexed: scanResult.papers.length,
    indexFileId: upload.fileId,
    generatedAt
  };
}

export async function rebuildAccessibleLibraryIndexes(session: Session) {
  const libraries = (await listLibrariesForSession(session)).filter(
    (library) => library.accessible && (library.canEdit || session.user.isOwner)
  );

  const rebuiltLibraryIds: string[] = [];
  for (const library of libraries) {
    await rebuildLibraryIndex(session, library.driveFolderId);
    rebuiltLibraryIds.push(library.driveFolderId);
  }

  return {
    ok: true,
    rebuiltLibraryIds
  };
}

export async function getLibraryIndex(
  session: Session | null,
  libraryId: string
): Promise<LibraryIndexData> {
  const driveClient = await createBrowsingDriveClient(session);
  await driveClient.getFileMetadata(libraryId);
  const bytes = await driveClient.downloadIndexSqlite(libraryId);
  if (!bytes) {
    throw new AppError("INDEX_NOT_FOUND", "This library has not been indexed yet.", 404);
  }

  const index = await parseIndexSqlite(bytes);
  return session?.user.hasDriveAccess ? index : filterIndexForPublicAccess(index) ?? {
    ...index,
    folders: [],
    papers: []
  };
}

export async function searchLibraryIndex(
  session: Session | null,
  libraryId: string,
  query: string
) {
  const driveClient = await createBrowsingDriveClient(session);
  await driveClient.getFileMetadata(libraryId);
  const bytes = await driveClient.downloadIndexSqlite(libraryId);
  if (!bytes) {
    throw new AppError("INDEX_NOT_FOUND", "This library has no index yet.", 404);
  }

  const results = await searchIndexSqlite(bytes, query);
  return session?.user.hasDriveAccess
    ? results
    : results.filter((paper) => isPubliclyAccessiblePaper(paper.accessLevel));
}

export async function createSubfolder(
  session: Session,
  input: { libraryId: string; parentFolderId: string; name: string }
) {
  const driveClient = await createSessionDriveClient(session);
  const parent = await driveClient.getFileMetadata(input.parentFolderId);
  if (!parent.capabilities?.canAddChildren) {
    throw new AppError(
      "DRIVE_ACCESS_DENIED",
      "You cannot create folders here with your Drive permissions.",
      403
    );
  }

  const folder = await driveClient.createFolder(input.parentFolderId, input.name.trim());
  await rebuildLibraryIndex(session, input.libraryId);
  return folder;
}

export async function updateFolderMetadata(
  session: Session,
  input: {
    libraryId: string;
    driveFolderId: string;
    name?: string;
    newParentFolderId?: string;
  }
) {
  const driveClient = await createSessionDriveClient(session);
  const current = await driveClient.getFileMetadata(input.driveFolderId);
  if (
    !current.capabilities?.canEdit &&
    !current.capabilities?.canRename &&
    !current.capabilities?.canMoveItemWithinDrive
  ) {
    throw new AppError(
      "DRIVE_ACCESS_DENIED",
      "You cannot rename or move this folder in Drive.",
      403
    );
  }

  const result = await driveClient.updateFolder(input.driveFolderId, {
    name: input.name?.trim() || undefined,
    newParentFolderId: input.newParentFolderId?.trim() || undefined
  });

  if (input.driveFolderId === input.libraryId) {
    const config = await loadLibraryConfig(driveClient);
    const nextConfig = upsertLibraryRecord(config, {
      id: input.libraryId,
      driveFolderId: input.libraryId,
      displayName: result.name
    });
    await saveLibraryConfig(driveClient, nextConfig);
  }

  await rebuildLibraryIndex(session, input.libraryId);
  return result;
}

export async function trashFolderInLibrary(
  session: Session,
  input: { driveFolderId: string; libraryId: string; confirm: boolean }
) {
  if (!input.confirm) {
    throw new AppError("INVALID_REQUEST", "Trash operations require confirmation.", 400);
  }

  const driveClient = await createSessionDriveClient(session);
  const current = await driveClient.getFileMetadata(input.driveFolderId);
  if (!current.capabilities?.canTrash && !current.capabilities?.canDelete) {
    throw new AppError("DRIVE_ACCESS_DENIED", "You cannot trash this folder in Drive.", 403);
  }

  await driveClient.trashFolder(input.driveFolderId);

  if (input.driveFolderId === input.libraryId) {
    const config = await loadLibraryConfig(driveClient);
    const nextConfig = removeLibraryRecord(config, input.libraryId);
    await saveLibraryConfig(driveClient, nextConfig);
    return;
  }

  await rebuildLibraryIndex(session, input.libraryId);
}

export async function uploadPaper(
  session: Session,
  input: {
    libraryId: string;
    parentFolderId: string;
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  }
) {
  const driveClient = await createSessionDriveClient(session);
  const parent = await driveClient.getFileMetadata(input.parentFolderId);
  if (!parent.capabilities?.canAddChildren) {
    throw new AppError("DRIVE_ACCESS_DENIED", "Upload is not allowed in this folder.", 403);
  }

  const result = await driveClient.uploadPdf(
    input.parentFolderId,
    input.fileName,
    input.mimeType,
    input.bytes
  );
  await rebuildLibraryIndex(session, input.libraryId);
  return result;
}

export async function updatePaperMetadata(
  session: Session,
  input: {
    driveFileId: string;
    fileName?: string;
    newParentFolderId?: string;
    libraryId: string;
  }
) {
  const driveClient = await createSessionDriveClient(session);
  const current = await driveClient.getFileMetadata(input.driveFileId);
  if (
    !current.capabilities?.canEdit &&
    !current.capabilities?.canRename &&
    !current.capabilities?.canMoveItemWithinDrive
  ) {
    throw new AppError(
      "DRIVE_ACCESS_DENIED",
      "You cannot rename or move this paper in Drive.",
      403
    );
  }

  const result = await driveClient.updatePaper(input.driveFileId, {
    fileName: input.fileName?.trim() || undefined,
    newParentFolderId: input.newParentFolderId?.trim() || undefined
  });
  await rebuildLibraryIndex(session, input.libraryId);
  return result;
}

export async function trashPaperInLibrary(
  session: Session,
  input: { driveFileId: string; libraryId: string; confirm: boolean }
) {
  if (!input.confirm) {
    throw new AppError("INVALID_REQUEST", "Trash operations require confirmation.", 400);
  }

  const driveClient = await createSessionDriveClient(session);
  const current = await driveClient.getFileMetadata(input.driveFileId);
  if (!current.capabilities?.canTrash && !current.capabilities?.canDelete) {
    throw new AppError("DRIVE_ACCESS_DENIED", "You cannot trash this paper in Drive.", 403);
  }

  await driveClient.trashPaper(input.driveFileId);
  await rebuildLibraryIndex(session, input.libraryId);
}

export async function loadLibraryConfigForSession(
  session: Session
): Promise<LibraryConfig> {
  const driveClient = await createSessionDriveClient(session);
  return loadLibraryConfig(driveClient);
}

export async function loadExplorerDataForSession(session: Session): Promise<{
  libraries: LibrarySummary[];
  folders: ExplorerFolder[];
  papers: ExplorerPaper[];
}> {
  if (!session.user.hasDriveAccess) {
    return loadExplorerDataForPublicAccess();
  }

  const libraries = (await listLibrariesForSession(session)).filter((library) => library.accessible);
  return loadExplorerDataFromLibraries(
    libraries,
    async (library) => {
      try {
        return await getLibraryIndex(session, library.driveFolderId);
      } catch {
        return null;
      }
    }
  );
}

export async function loadExplorerDataForPublicAccess(): Promise<{
  libraries: LibrarySummary[];
  folders: ExplorerFolder[];
  papers: ExplorerPaper[];
}> {
  const driveClient = await createPublicDriveClient();
  const libraries = await listPublicLibraries();
  const indexed = await Promise.all(
    libraries.map(async (library) => {
      try {
        const bytes = await driveClient.downloadIndexSqlite(library.driveFolderId);
        if (!bytes) {
          return null;
        }

        const index = filterIndexForPublicAccess(await parseIndexSqlite(bytes));
        if (!index) {
          return null;
        }

        return { library, index };
      } catch {
        return null;
      }
    })
  );

  return buildExplorerData(
    indexed.filter((entry): entry is { library: LibrarySummary; index: LibraryIndexData } =>
      Boolean(entry)
    )
  );
}

async function loadExplorerDataFromLibraries(
  libraries: LibrarySummary[],
  loadIndex: (library: LibrarySummary) => Promise<LibraryIndexData | null>
): Promise<{
  libraries: LibrarySummary[];
  folders: ExplorerFolder[];
  papers: ExplorerPaper[];
}> {
  const indexed = await Promise.all(
    libraries.map(async (library) => ({
      library,
      index: await loadIndex(library)
    }))
  );

  return buildExplorerData(indexed);
}

function buildExplorerData(
  indexed: Array<{ library: LibrarySummary; index: LibraryIndexData | null }>
): {
  libraries: LibrarySummary[];
  folders: ExplorerFolder[];
  papers: ExplorerPaper[];
} {
  const folders: ExplorerFolder[] = indexed.flatMap(({ library, index }) => {
    if (!index) {
      return [
        {
          libraryId: library.driveFolderId,
          libraryName: library.name,
          libraryCanEdit: library.canEdit,
          driveFolderId: library.driveFolderId,
          parentFolderId: null,
          name: library.name,
          path: library.name,
          depth: 0
        }
      ];
    }

    return index.folders.map((folder) => ({
      ...folder,
      libraryId: library.driveFolderId,
      libraryName: library.name,
      libraryCanEdit: library.canEdit
    }));
  });

  const papers: ExplorerPaper[] = indexed.flatMap(({ library, index }) =>
    index
      ? index.papers.map((paper) => ({
          ...paper,
          libraryId: library.driveFolderId,
          libraryName: library.name
        }))
      : []
  );

  return { libraries: indexed.map(({ library }) => library), folders, papers };
}
