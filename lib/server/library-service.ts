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
  LibrarySummary
} from "@/lib/models";
import { parseDriveFolderInput } from "@/lib/utils/drive";

export async function createSessionDriveClient(session: Session): Promise<DriveClient> {
  return getDriveClientForSession(session);
}

export async function createPublicDriveClient(): Promise<DriveClient> {
  return getPublicDriveClient();
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

export async function getLibraryIndex(
  session: Session,
  libraryId: string
): Promise<LibraryIndexData> {
  const driveClient = await createSessionDriveClient(session);
  await driveClient.getFileMetadata(libraryId);
  const bytes = await driveClient.downloadIndexSqlite(libraryId);
  if (!bytes) {
    throw new AppError("INDEX_NOT_FOUND", "This library has not been indexed yet.", 404);
  }

  return parseIndexSqlite(bytes);
}

export async function searchLibraryIndex(
  session: Session,
  libraryId: string,
  query: string
) {
  const driveClient = await createSessionDriveClient(session);
  await driveClient.getFileMetadata(libraryId);
  const bytes = await driveClient.downloadIndexSqlite(libraryId);
  if (!bytes) {
    throw new AppError("INDEX_NOT_FOUND", "This library has no index yet.", 404);
  }

  return searchIndexSqlite(bytes, query);
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
  return loadExplorerDataFromLibraries(
    libraries,
    async (library) => {
      try {
        const bytes = await driveClient.downloadIndexSqlite(library.driveFolderId);
        return bytes ? parseIndexSqlite(bytes) : null;
      } catch {
        return null;
      }
    }
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

  return { libraries, folders, papers };
}
