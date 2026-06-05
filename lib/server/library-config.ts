import { getDefaultLibraryFolderIds } from "@/lib/env";
import { LibraryConfig, LibraryRecord } from "@/lib/models";
import { DriveClient } from "@/lib/google/drive";

function nowIso() {
  return new Date().toISOString();
}

export function createEmptyLibraryConfig(): LibraryConfig {
  return {
    version: 1,
    updatedAt: nowIso(),
    libraries: []
  };
}

export function normalizeLibraryConfig(
  config: Partial<LibraryConfig> | null | undefined
): LibraryConfig {
  return {
    version: 1,
    updatedAt: config?.updatedAt ?? nowIso(),
    libraries: config?.libraries ?? []
  };
}

export function upsertLibraryRecord(
  config: LibraryConfig,
  library: Pick<LibraryRecord, "driveFolderId" | "displayName"> &
    Partial<
      Pick<
        LibraryRecord,
        "id" | "addedAt" | "cachedPaperCount" | "cachedFolderCount" | "cachedGeneratedAt"
      >
    >
): LibraryConfig {
  const existing = config.libraries.find(
    (entry) => entry.driveFolderId === library.driveFolderId
  );

  const nextRecord: LibraryRecord = existing
    ? {
        ...existing,
        displayName: library.displayName ?? existing.displayName,
        cachedPaperCount: library.cachedPaperCount ?? existing.cachedPaperCount,
        cachedFolderCount: library.cachedFolderCount ?? existing.cachedFolderCount,
        cachedGeneratedAt: library.cachedGeneratedAt ?? existing.cachedGeneratedAt
      }
    : {
        id: library.id ?? library.driveFolderId,
        driveFolderId: library.driveFolderId,
        displayName: library.displayName,
        addedAt: library.addedAt ?? nowIso(),
        cachedPaperCount: library.cachedPaperCount,
        cachedFolderCount: library.cachedFolderCount,
        cachedGeneratedAt: library.cachedGeneratedAt
      };

  const nextLibraries = existing
    ? config.libraries.map((entry) =>
        entry.driveFolderId === nextRecord.driveFolderId ? nextRecord : entry
      )
    : [...config.libraries, nextRecord];

  return {
    version: 1,
    updatedAt: nowIso(),
    libraries: nextLibraries
  };
}

export function removeLibraryRecord(
  config: LibraryConfig,
  libraryId: string
): LibraryConfig {
  return {
    version: 1,
    updatedAt: nowIso(),
    libraries: config.libraries.filter((entry) => entry.id !== libraryId)
  };
}

export async function loadLibraryConfig(driveClient: DriveClient): Promise<LibraryConfig> {
  const json = await driveClient.readAppConfig();
  const defaults = getDefaultLibraryFolderIds();

  const baseConfig = json
    ? normalizeLibraryConfig(JSON.parse(json) as LibraryConfig)
    : createEmptyLibraryConfig();

  return defaults.reduce(
    (config, folderId) =>
      upsertLibraryRecord(config, {
        id: folderId,
        driveFolderId: folderId
      }),
    baseConfig
  );
}

export async function saveLibraryConfig(
  driveClient: DriveClient,
  config: LibraryConfig
): Promise<void> {
  await driveClient.writeAppConfig(JSON.stringify(config, null, 2));
}
