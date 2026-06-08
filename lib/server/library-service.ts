import { Session } from "next-auth";

import { AppError } from "@/lib/errors";
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
  LibraryRecord,
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

function getDirectSharedUserIds(
  entry: { sharedUsers?: Array<{ id: string }> }
): string[] {
  return entry.sharedUsers?.map((user) => user.id) ?? [];
}

function deriveAccessibleIndex(
  source: LibraryIndexData,
  visibility: { kind: "anyone" } | { kind: "user"; userId: string }
): LibraryIndexData | null {
  const folderById = new Map(source.folders.map((folder) => [folder.driveFolderId, folder]));
  const childrenByParent = new Map<string, string[]>();
  const papersByFolder = new Map<string, typeof source.papers>();

  for (const folder of source.folders) {
    const key = folder.parentFolderId ?? "";
    const bucket = childrenByParent.get(key) ?? [];
    bucket.push(folder.driveFolderId);
    childrenByParent.set(key, bucket);
  }

  for (const paper of source.papers) {
    const bucket = papersByFolder.get(paper.driveFolderId) ?? [];
    bucket.push(paper);
    papersByFolder.set(paper.driveFolderId, bucket);
  }

  const visibleFolderIds = new Set<string>();
  const visiblePaperIds = new Set<string>();

  const includeAncestors = (folderId: string | null | undefined) => {
    let cursor = folderId ? folderById.get(folderId) : undefined;
    while (cursor && !visibleFolderIds.has(cursor.driveFolderId)) {
      visibleFolderIds.add(cursor.driveFolderId);
      cursor = cursor.parentFolderId ? folderById.get(cursor.parentFolderId) : undefined;
    }
  };

  const includeSubtree = (rootFolderId: string) => {
    const queue = [rootFolderId];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visibleFolderIds.has(currentId)) {
        continue;
      }

      visibleFolderIds.add(currentId);
      for (const paper of papersByFolder.get(currentId) ?? []) {
        visiblePaperIds.add(paper.driveFileId);
      }
      for (const childId of childrenByParent.get(currentId) ?? []) {
        queue.push(childId);
      }
    }
  };

  const folderIsVisible = (folder: LibraryIndexData["folders"][number]) =>
    visibility.kind === "anyone"
      ? isPubliclyAccessiblePaper(folder.accessLevel ?? "restricted")
      : getDirectSharedUserIds(folder).includes(visibility.userId);

  const paperIsVisible = (paper: LibraryIndexData["papers"][number]) =>
    visibility.kind === "anyone"
      ? isPubliclyAccessiblePaper(paper.accessLevel)
      : getDirectSharedUserIds(paper).includes(visibility.userId);

  for (const folder of source.folders) {
    if (!folderIsVisible(folder)) {
      continue;
    }

    includeAncestors(folder.driveFolderId);
    includeSubtree(folder.driveFolderId);
  }

  for (const paper of source.papers) {
    if (!paperIsVisible(paper)) {
      continue;
    }

    visiblePaperIds.add(paper.driveFileId);
    includeAncestors(paper.driveFolderId);
  }

  if (visiblePaperIds.size === 0 && visibleFolderIds.size === 0) {
    return null;
  }

  return {
    generatedAt: source.generatedAt,
    sourceLibraryId: source.sourceLibraryId,
    sourceLibraryName: source.sourceLibraryName,
    indexKind: visibility.kind,
    userId: visibility.kind === "user" ? visibility.userId : undefined,
    folders: source.folders.filter((folder) => visibleFolderIds.has(folder.driveFolderId)),
    papers: source.papers.filter((paper) => visiblePaperIds.has(paper.driveFileId))
  };
}

function collectSharedUsers(index: LibraryIndexData): Array<{ id: string; emailAddress: string }> {
  const users = new Map<string, string>();

  for (const entry of [...index.folders, ...index.papers]) {
    for (const user of entry.sharedUsers ?? []) {
      if (user.emailAddress) {
        users.set(user.id, user.emailAddress);
      }
    }
  }

  return [...users.entries()].map(([id, emailAddress]) => ({ id, emailAddress }));
}

function mergeIndexData(indexes: LibraryIndexData[]): LibraryIndexData {
  const folders = new Map<string, ExplorerFolder | LibraryIndexData["folders"][number]>();
  const papers = new Map<string, ExplorerPaper | LibraryIndexData["papers"][number]>();

  for (const index of indexes) {
    for (const folder of index.folders) {
      folders.set(folder.driveFolderId, folder);
    }
    for (const paper of index.papers) {
      papers.set(paper.driveFileId, paper);
    }
  }

  return {
    generatedAt: indexes.map((index) => index.generatedAt).filter(Boolean).sort().at(-1),
    sourceLibraryId: indexes[0]?.sourceLibraryId,
    sourceLibraryName: indexes[0]?.sourceLibraryName,
    folders: [...folders.values()] as LibraryIndexData["folders"],
    papers: [...papers.values()] as LibraryIndexData["papers"]
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

export function mergeLibraryRecords(
  configuredLibraries: LibraryRecord[],
  discoveredDriveFolderIds: string[]
): LibraryRecord[] {
  const merged = new Map(
    configuredLibraries.map((library) => [library.driveFolderId, library] as const)
  );

  for (const driveFolderId of discoveredDriveFolderIds) {
    if (merged.has(driveFolderId)) {
      continue;
    }

    merged.set(driveFolderId, {
      id: driveFolderId,
      driveFolderId,
      addedAt: new Date().toISOString()
    });
  }

  return [...merged.values()];
}

async function loadAccessibleDerivedIndexesForSession(
  session: Session
): Promise<Map<string, LibraryIndexData[]>> {
  const driveClient = await createSessionDriveClient(session);
  const currentUserId = await driveClient.getCurrentUserPermissionId();
  const files = [
    ...(await driveClient.listAccessibleManagedIndexFiles({ kind: "anyone" })),
    ...(currentUserId
      ? await driveClient.listAccessibleManagedIndexFiles({ kind: "user", userId: currentUserId })
      : [])
  ];

  const grouped = new Map<string, LibraryIndexData[]>();
  for (const file of files) {
    try {
      const bytes = await driveClient.downloadFileBytes(file.id);
      const index = await parseIndexSqlite(bytes);
      if (!index.sourceLibraryId) {
        continue;
      }

      const bucket = grouped.get(index.sourceLibraryId) ?? [];
      bucket.push(index);
      grouped.set(index.sourceLibraryId, bucket);
    } catch {
      continue;
    }
  }

  return grouped;
}

async function loadAccessibleDerivedIndexesForPublic(): Promise<Map<string, LibraryIndexData[]>> {
  const driveClient = await createPublicDriveClient();
  const files = await driveClient.listAccessibleManagedIndexFiles({ kind: "anyone" });
  const grouped = new Map<string, LibraryIndexData[]>();

  for (const file of files) {
    try {
      const bytes = await driveClient.downloadFileBytes(file.id);
      const index = await parseIndexSqlite(bytes);
      if (!index.sourceLibraryId) {
        continue;
      }

      const bucket = grouped.get(index.sourceLibraryId) ?? [];
      bucket.push(index);
      grouped.set(index.sourceLibraryId, bucket);
    } catch {
      continue;
    }
  }

  return grouped;
}

export async function listLibrariesForSession(session: Session): Promise<LibrarySummary[]> {
  if (!session.user.isOwner) {
    const indexesByLibraryId = await loadAccessibleDerivedIndexesForSession(session);
    return [...indexesByLibraryId.entries()].map(([libraryId, indexes]) => {
      const merged = mergeIndexData(indexes);
      return {
        id: libraryId,
        name: merged.sourceLibraryName ?? libraryId,
        driveFolderId: libraryId,
        accessible: true,
        canEdit: false,
        canAddChildren: false,
        indexStatus: "ok" as const,
        generatedAt: merged.generatedAt,
        paperCount: merged.papers.length,
        folderCount: merged.folders.length
      };
    });
  }

  const driveClient = await createSessionDriveClient(session);
  const config = await loadLibraryConfig(driveClient);
  const discoveredDriveFolderIds = await driveClient.discoverLibraryRootIds();
  const libraries = mergeLibraryRecords(config.libraries, discoveredDriveFolderIds);

  const summaries = await Promise.all(libraries.map((library) => summarizeLibrary(driveClient, library)));

  return summaries;
}

export async function listPublicLibraries(): Promise<LibrarySummary[]> {
  const indexesByLibraryId = await loadAccessibleDerivedIndexesForPublic();
  return [...indexesByLibraryId.entries()].map(([libraryId, indexes]) => {
    const merged = mergeIndexData(indexes);
    return {
      id: libraryId,
      name: merged.sourceLibraryName ?? libraryId,
      driveFolderId: libraryId,
      accessible: true,
      canEdit: false,
      canAddChildren: false,
      indexStatus: "ok" as const,
      generatedAt: merged.generatedAt,
      paperCount: merged.papers.length,
      folderCount: merged.folders.length
    };
  });
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
  const generatedAt = new Date().toISOString();
  const masterIndex: LibraryIndexData = {
    generatedAt,
    sourceLibraryId: libraryId,
    sourceLibraryName: metadata.name,
    indexKind: "master",
    folders: scanResult.folders,
    papers: scanResult.papers
  };
  const masterBytes = await createIndexSqlite({
    folders: masterIndex.folders,
    papers: masterIndex.papers,
    metadata: {
      generatedAt,
      sourceLibraryId: libraryId,
      sourceLibraryName: metadata.name,
      indexKind: "master"
    }
  });
  const upload = await driveClient.uploadOrUpdateManagedIndex(libraryId, {
    kind: "master",
    bytes: masterBytes
  });

  const anyoneIndex = deriveAccessibleIndex(masterIndex, { kind: "anyone" });
  const anyoneBytes = await createIndexSqlite({
    folders: anyoneIndex?.folders ?? [],
    papers: anyoneIndex?.papers ?? [],
    metadata: {
      generatedAt,
      sourceLibraryId: libraryId,
      sourceLibraryName: metadata.name,
      indexKind: "anyone"
    }
  });
  await driveClient.uploadOrUpdateManagedIndex(libraryId, {
    kind: "anyone",
    bytes: anyoneBytes
  });

  const sharedUsers = collectSharedUsers(masterIndex);
  const activeUserIds = new Set(sharedUsers.map((user) => user.id));
  for (const user of sharedUsers) {
    const userIndex = deriveAccessibleIndex(masterIndex, {
      kind: "user",
      userId: user.id
    });
    if (!userIndex) {
      continue;
    }

    const userBytes = await createIndexSqlite({
      folders: userIndex.folders,
      papers: userIndex.papers,
      metadata: {
        generatedAt,
        sourceLibraryId: libraryId,
        sourceLibraryName: metadata.name,
        indexKind: "user",
        userId: user.id
      }
    });

    await driveClient.uploadOrUpdateManagedIndex(libraryId, {
      kind: "user",
      userId: user.id,
      shareWithUserEmail: user.emailAddress,
      bytes: userBytes
    });
  }

  const existingUserIndexes = await driveClient.listManagedUserIndexFiles(libraryId);
  for (const existingIndex of existingUserIndexes) {
    const matchedUserId = existingIndex.name.match(/^papershelf-user-(.+)\.sqlite$/)?.[1];
    if (!matchedUserId || !activeUserIds.has(matchedUserId)) {
      await driveClient.trashPaper(existingIndex.id);
    }
  }

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

async function loadMergedDerivedIndexForLibrary(
  driveClient: DriveClient,
  input: { libraryId: string; userId?: string }
): Promise<LibraryIndexData> {
  const indexes: LibraryIndexData[] = [];
  const anyoneFiles = await driveClient.listAccessibleManagedIndexFiles({ kind: "anyone" });

  for (const file of anyoneFiles) {
    const bytes = await driveClient.downloadFileBytes(file.id);
    const index = await parseIndexSqlite(bytes);
    if (index.sourceLibraryId === input.libraryId) {
      indexes.push(index);
    }
  }

  if (input.userId) {
    const userFiles = await driveClient.listAccessibleManagedIndexFiles({
      kind: "user",
      userId: input.userId
    });

    for (const file of userFiles) {
      const bytes = await driveClient.downloadFileBytes(file.id);
      const index = await parseIndexSqlite(bytes);
      if (index.sourceLibraryId === input.libraryId) {
        indexes.push(index);
      }
    }
  }

  if (indexes.length === 0) {
    throw new AppError("INDEX_NOT_FOUND", "This library has not been indexed yet.", 404);
  }

  return mergeIndexData(indexes);
}

export async function getLibraryIndex(
  session: Session | null,
  libraryId: string
): Promise<LibraryIndexData> {
  if (session?.user.isOwner && session.user.hasDriveAccess) {
    const driveClient = await createSessionDriveClient(session);
    const bytes = await driveClient.downloadIndexSqlite(libraryId);
    if (!bytes) {
      throw new AppError("INDEX_NOT_FOUND", "This library has not been indexed yet.", 404);
    }

    return parseIndexSqlite(bytes);
  }

  const driveClient = await createBrowsingDriveClient(session);
  const userId = session?.user.hasDriveAccess
    ? await driveClient.getCurrentUserPermissionId()
    : undefined;
  return loadMergedDerivedIndexForLibrary(driveClient, { libraryId, userId: userId ?? undefined });
}

export async function searchLibraryIndex(
  session: Session | null,
  libraryId: string,
  query: string
) {
  const index = await getLibraryIndex(session, libraryId);
  const bytes = await createIndexSqlite({
    folders: index.folders,
    papers: index.papers,
    metadata: {
      generatedAt: index.generatedAt,
      sourceLibraryId: index.sourceLibraryId,
      sourceLibraryName: index.sourceLibraryName,
      indexKind: index.indexKind,
      userId: index.userId
    }
  });
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
  if (!session.user.hasDriveAccess) {
    return loadExplorerDataForPublicAccess();
  }

  const libraries = (await listLibrariesForSession(session)).filter((library) => library.accessible);
  return loadExplorerDataFromLibraries(libraries, async (library) => {
    try {
      return await getLibraryIndex(session, library.driveFolderId);
    } catch {
      return null;
    }
  });
}

export async function loadExplorerDataForPublicAccess(): Promise<{
  libraries: LibrarySummary[];
  folders: ExplorerFolder[];
  papers: ExplorerPaper[];
}> {
  const libraries = await listPublicLibraries();
  return loadExplorerDataFromLibraries(libraries, async (library) => {
    try {
      return await getLibraryIndex(null, library.driveFolderId);
    } catch {
      return null;
    }
  });
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
