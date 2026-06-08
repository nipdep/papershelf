import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { Session } from "next-auth";

import { AppError } from "@/lib/errors";
import { getGoogleApiKey } from "@/lib/env";
import { DriveItem } from "@/lib/models";
import { requireDriveAccess } from "@/lib/server/authz";

export type ManagedIndexKind = "master" | "anyone" | "user";

const DRIVE_FIELDS = [
  "id",
  "name",
  "mimeType",
  "parents",
  "modifiedTime",
  "createdTime",
  "size",
  "webViewLink",
  "appProperties",
  "capabilities(canEdit,canAddChildren,canDelete,canTrash,canRename,canMoveItemWithinDrive)",
  "permissions(id,type,role,allowFileDiscovery,emailAddress,domain)"
].join(",");

const APP_DATA_CONFIG_NAME = "papershelf-config.json";
const PAPER_MANAGER_FOLDER_NAME = ".paper-manager";
const PAPER_MANAGER_USERS_FOLDER_NAME = "users";
const MASTER_INDEX_FILE_NAME = "papershelf-master-index.sqlite";
const ANYONE_INDEX_FILE_NAME = "papershelf-anyone-index.sqlite";
const USER_INDEX_FILE_PREFIX = "papershelf-user-";
const PUBLIC_LIBRARY_MANIFEST_FILE_NAME = "papershelf-public-library.json";
const PUBLIC_REGISTRY_FOLDER_NAME = ".papershelf-public";
const PUBLIC_CATALOG_FILE_NAME = "papershelf-public-catalog.json";

function getDriveErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  ) {
    return error.code;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
  ) {
    return error.response.status;
  }

  return undefined;
}

function toAuthenticationError(error: unknown): AppError | null {
  const status = getDriveErrorStatus(error);
  if (status === 401) {
    return new AppError(
      "NOT_AUTHENTICATED",
      "Your Google session expired or was revoked. Please sign in again.",
      401
    );
  }

  return null;
}

function toDriveNotFoundError(error: unknown): AppError {
  return (
    toAuthenticationError(error) ??
    new AppError("DRIVE_NOT_FOUND", "Drive item not found.", 404)
  );
}

export interface DriveClient {
  getFileMetadata(fileId: string): Promise<DriveItem>;
  getIndexFileMetadata(rootFolderId: string): Promise<DriveItem | null>;
  discoverLibraryRootIds(): Promise<string[]>;
  getCurrentUserPermissionId(): Promise<string | null>;
  listAccessibleManagedIndexFiles(
    input: { kind: "anyone" } | { kind: "user"; userId: string }
  ): Promise<DriveItem[]>;
  listPublicLibraryManifestFiles(): Promise<DriveItem[]>;
  listPublicCatalogFiles(): Promise<DriveItem[]>;
  listManagedUserIndexFiles(rootFolderId: string): Promise<DriveItem[]>;
  listFolderChildren(
    folderId: string,
    pageToken?: string
  ): Promise<{ items: DriveItem[]; nextPageToken?: string }>;
  ensurePaperManagerFolder(rootFolderId: string): Promise<DriveItem>;
  uploadOrUpdateManagedIndex(
    rootFolderId: string,
    input: {
      kind: ManagedIndexKind;
      bytes: Uint8Array;
      userId?: string;
      shareWithUserEmail?: string;
    }
  ): Promise<{ fileId: string }>;
  downloadManagedIndex(
    rootFolderId: string,
    input: { kind: ManagedIndexKind; userId?: string }
  ): Promise<Uint8Array | null>;
  downloadFileBytes(fileId: string): Promise<Uint8Array>;
  downloadFileText(fileId: string): Promise<string>;
  uploadOrUpdatePublicCatalog(json: string): Promise<{ fileId: string }>;
  uploadOrUpdatePublicLibraryManifest(
    rootFolderId: string,
    json: string
  ): Promise<{ fileId: string }>;
  removePublicLibraryManifest(rootFolderId: string): Promise<void>;
  uploadOrUpdateIndexSqlite(
    rootFolderId: string,
    bytes: Uint8Array
  ): Promise<{ fileId: string }>;
  downloadIndexSqlite(rootFolderId: string): Promise<Uint8Array | null>;
  readAppConfig(): Promise<string | null>;
  writeAppConfig(json: string): Promise<void>;
  createFolder(parentFolderId: string, name: string): Promise<DriveItem>;
  updateFolder(
    driveFolderId: string,
    updates: { name?: string; newParentFolderId?: string }
  ): Promise<DriveItem>;
  trashFolder(driveFolderId: string): Promise<void>;
  uploadPdf(
    parentFolderId: string,
    fileName: string,
    mimeType: string,
    bytes: Uint8Array
  ): Promise<DriveItem>;
  updatePaper(
    driveFileId: string,
    updates: { fileName?: string; newParentFolderId?: string }
  ): Promise<DriveItem>;
  trashPaper(driveFileId: string): Promise<void>;
}

function mapDriveFile(file?: drive_v3.Schema$File | null): DriveItem {
  if (!file?.id || !file.name || !file.mimeType) {
    throw new AppError("DRIVE_NOT_FOUND", "Drive item metadata is incomplete.", 404);
  }

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    parents: file.parents ?? undefined,
    modifiedTime: file.modifiedTime ?? undefined,
    createdTime: file.createdTime ?? undefined,
    size: file.size ? Number(file.size) : undefined,
    webViewLink: file.webViewLink ?? undefined,
    capabilities: file.capabilities
      ? {
          canEdit: file.capabilities.canEdit ?? undefined,
          canAddChildren: file.capabilities.canAddChildren ?? undefined,
          canDelete: file.capabilities.canDelete ?? undefined,
          canTrash: file.capabilities.canTrash ?? undefined,
          canRename: file.capabilities.canRename ?? undefined,
          canMoveItemWithinDrive:
            file.capabilities.canMoveItemWithinDrive ?? undefined
        }
      : undefined,
    permissions: file.permissions?.map((permission) => ({
      id: permission.id ?? undefined,
      type: permission.type ?? undefined,
      role: permission.role ?? undefined,
      allowFileDiscovery: permission.allowFileDiscovery ?? undefined,
      emailAddress: permission.emailAddress ?? undefined,
      domain: permission.domain ?? undefined
    })),
    appProperties: file.appProperties ?? undefined
  };
}

async function findChildByName(
  drive: drive_v3.Drive,
  parentFolderId: string,
  name: string
): Promise<DriveItem | null> {
  const response = await drive.files.list({
    q: `'${parentFolderId}' in parents and trashed = false and name = '${name.replace(/'/g, "\\'")}'`,
    fields: `files(${DRIVE_FIELDS})`,
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const file = response.data.files?.[0];
  return file ? mapDriveFile(file) : null;
}

async function getOrCreatePaperManagerFolder(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<DriveItem> {
  const existing = await findChildByName(drive, rootFolderId, ".paper-manager");
  if (existing) {
    return existing;
  }

  const created = await drive.files.create({
    requestBody: {
      name: ".paper-manager",
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId]
    },
    fields: DRIVE_FIELDS,
    supportsAllDrives: true
  });

  return mapDriveFile(created.data);
}

async function getPaperManagerFolder(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<DriveItem | null> {
  return findChildByName(drive, rootFolderId, PAPER_MANAGER_FOLDER_NAME);
}

async function getOrCreateUsersFolder(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<DriveItem> {
  const paperManagerFolder = await getOrCreatePaperManagerFolder(drive, rootFolderId);
  const existing = await findChildByName(drive, paperManagerFolder.id, PAPER_MANAGER_USERS_FOLDER_NAME);
  if (existing) {
    return existing;
  }

  const created = await drive.files.create({
    requestBody: {
      name: PAPER_MANAGER_USERS_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [paperManagerFolder.id]
    },
    fields: DRIVE_FIELDS,
    supportsAllDrives: true
  });

  return mapDriveFile(created.data);
}

function getManagedIndexFileName(kind: ManagedIndexKind, userId?: string): string {
  switch (kind) {
    case "master":
      return MASTER_INDEX_FILE_NAME;
    case "anyone":
      return ANYONE_INDEX_FILE_NAME;
    case "user":
      if (!userId) {
        throw new AppError("INVALID_REQUEST", "userId is required for user indexes.", 400);
      }
      return `${USER_INDEX_FILE_PREFIX}${userId}.sqlite`;
  }
}

async function getManagedIndexParentFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  kind: ManagedIndexKind
): Promise<DriveItem | null> {
  if (kind === "user") {
    const paperManagerFolder = await getPaperManagerFolder(drive, rootFolderId);
    if (!paperManagerFolder) {
      return null;
    }

    return findChildByName(drive, paperManagerFolder.id, PAPER_MANAGER_USERS_FOLDER_NAME);
  }

  return getPaperManagerFolder(drive, rootFolderId);
}

async function getOrCreateManagedIndexParentFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  kind: ManagedIndexKind
): Promise<DriveItem> {
  if (kind === "user") {
    return getOrCreateUsersFolder(drive, rootFolderId);
  }

  return getOrCreatePaperManagerFolder(drive, rootFolderId);
}

async function findPublicLibraryManifestFile(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<DriveItem | null> {
  const folder = await getPaperManagerFolder(drive, rootFolderId);
  if (!folder) {
    return null;
  }

  return findChildByName(drive, folder.id, PUBLIC_LIBRARY_MANIFEST_FILE_NAME);
}

async function getOrCreatePublicRegistryFolder(drive: drive_v3.Drive): Promise<DriveItem> {
  const existing = await findChildByName(drive, "root", PUBLIC_REGISTRY_FOLDER_NAME);
  if (existing) {
    return existing;
  }

  const created = await drive.files.create({
    requestBody: {
      name: PUBLIC_REGISTRY_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"]
    },
    fields: DRIVE_FIELDS,
    supportsAllDrives: true
  });

  return mapDriveFile(created.data);
}

async function findPublicCatalogFile(drive: drive_v3.Drive): Promise<DriveItem | null> {
  const folder = await getOrCreatePublicRegistryFolder(drive);
  return findChildByName(drive, folder.id, PUBLIC_CATALOG_FILE_NAME);
}

async function discoverLibraryRootIds(drive: drive_v3.Drive): Promise<string[]> {
  const rootIds = new Set<string>();
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and name = '.paper-manager' and trashed = false`,
      pageToken,
      pageSize: 100,
      fields: `nextPageToken,files(${DRIVE_FIELDS})`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    for (const file of response.data.files ?? []) {
      const folder = mapDriveFile(file);
      const rootId = folder.parents?.[0];
      if (rootId) {
        rootIds.add(rootId);
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return [...rootIds];
}

async function findIndexFile(
  drive: drive_v3.Drive,
  paperManagerFolderId: string
): Promise<DriveItem | null> {
  return findChildByName(drive, paperManagerFolderId, MASTER_INDEX_FILE_NAME);
}

async function findManagedIndexFile(
  drive: drive_v3.Drive,
  rootFolderId: string,
  input: { kind: ManagedIndexKind; userId?: string }
): Promise<DriveItem | null> {
  const folder = await getManagedIndexParentFolder(drive, rootFolderId, input.kind);
  if (!folder) {
    return null;
  }

  return findChildByName(drive, folder.id, getManagedIndexFileName(input.kind, input.userId));
}

async function getIndexFileForRoot(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<DriveItem | null> {
  return findManagedIndexFile(drive, rootFolderId, { kind: "master" });
}

async function searchFilesByName(
  drive: drive_v3.Drive,
  name: string
): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
      pageToken,
      pageSize: 100,
      fields: `nextPageToken,files(${DRIVE_FIELDS})`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    items.push(...(response.data.files ?? []).map(mapDriveFile));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

async function downloadDriveFileBytes(
  drive: drive_v3.Drive,
  fileId: string
): Promise<Uint8Array> {
  const response = await drive.files.get(
    {
      fileId,
      alt: "media",
      supportsAllDrives: true
    },
    {
      responseType: "arraybuffer"
    }
  );

  return new Uint8Array(response.data as ArrayBuffer);
}

async function downloadDriveFileText(
  drive: drive_v3.Drive,
  fileId: string
): Promise<string> {
  const response = await drive.files.get(
    {
      fileId,
      alt: "media",
      supportsAllDrives: true
    },
    {
      responseType: "text"
    }
  );

  return String(response.data);
}

async function ensureUserReadPermission(
  drive: drive_v3.Drive,
  fileId: string,
  emailAddress: string
) {
  const existing = await drive.permissions.list({
    fileId,
    fields: "permissions(id,type,role,emailAddress)",
    supportsAllDrives: true
  });

  const alreadyShared = (existing.data.permissions ?? []).some(
    (permission) =>
      permission.type === "user" &&
      permission.role !== "none" &&
      permission.emailAddress?.toLowerCase() === emailAddress.toLowerCase()
  );

  if (alreadyShared) {
    return;
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "user",
      role: "reader",
      emailAddress
    },
    supportsAllDrives: true,
    sendNotificationEmail: false
  });
}

async function ensureAnyoneReadPermission(
  drive: drive_v3.Drive,
  fileId: string
) {
  return ensurePublicReadPermission(drive, fileId, false);
}

async function ensurePublicReadPermission(
  drive: drive_v3.Drive,
  fileId: string,
  allowFileDiscovery: boolean
) {
  const existing = await drive.permissions.list({
    fileId,
    fields: "permissions(id,type,role,allowFileDiscovery)",
    supportsAllDrives: true
  });

  const existingAnyonePermission = (existing.data.permissions ?? []).find(
    (permission) =>
      permission.type === "anyone" &&
      permission.role !== "none"
  );

  if (existingAnyonePermission?.allowFileDiscovery === allowFileDiscovery) {
    return;
  }

  if (existingAnyonePermission?.id) {
    await drive.permissions.update({
      fileId,
      permissionId: existingAnyonePermission.id,
      requestBody: {
        role: "reader",
        allowFileDiscovery
      },
      supportsAllDrives: true
    });
    return;
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "anyone",
      role: "reader",
      allowFileDiscovery
    },
    supportsAllDrives: true
  });
}

async function getAppConfigFile(drive: drive_v3.Drive): Promise<DriveItem | null> {
  const response = await drive.files.list({
    spaces: "appDataFolder",
    q: `name = '${APP_DATA_CONFIG_NAME}' and trashed = false`,
    fields: `files(${DRIVE_FIELDS})`,
    pageSize: 10
  });
  const file = response.data.files?.[0];
  return file ? mapDriveFile(file) : null;
}

export async function getDriveClientForSession(session: Session): Promise<DriveClient> {
  const accessToken = requireDriveAccess(session).user.accessToken!;

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: "v3", auth });
  return createDriveClient(drive, "session");
}

export async function getPublicDriveClient(): Promise<DriveClient> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new AppError(
      "NOT_AUTHENTICATED",
      "Public Drive browsing is not configured for this app.",
      401
    );
  }

  const drive = google.drive({ version: "v3", auth: apiKey });
  return createDriveClient(drive, "public");
}

function createReadOnlyDriveError(): AppError {
  return new AppError(
    "DRIVE_ACCESS_DENIED",
    "This Drive client is read-only for publicly shared content.",
    403
  );
}

function createDriveClient(
  drive: drive_v3.Drive,
  accessMode: "session" | "public"
): DriveClient {
  const getMetadata = async (fileId: string) => {
    try {
      const response = await drive.files.get({
        fileId,
        fields: DRIVE_FIELDS,
        supportsAllDrives: true
      });
      return mapDriveFile(response.data);
    } catch (error) {
      throw toDriveNotFoundError(error);
    }
  };

  return {
    getFileMetadata: getMetadata,

    async getIndexFileMetadata(rootFolderId) {
      return getIndexFileForRoot(drive, rootFolderId);
    },

    async discoverLibraryRootIds() {
      try {
        return await discoverLibraryRootIds(drive);
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }
    },

    async getCurrentUserPermissionId() {
      if (accessMode === "public") {
        return null;
      }

      try {
        const response = await drive.about.get({
          fields: "user(permissionId,emailAddress)"
        });
        return response.data.user?.permissionId ?? null;
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }
    },

    async listAccessibleManagedIndexFiles(input) {
      try {
        return await searchFilesByName(
          drive,
          getManagedIndexFileName(input.kind, "userId" in input ? input.userId : undefined)
        );
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }
    },

    async listPublicLibraryManifestFiles() {
      try {
        return await searchFilesByName(drive, PUBLIC_LIBRARY_MANIFEST_FILE_NAME);
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }
    },

    async listPublicCatalogFiles() {
      try {
        return await searchFilesByName(drive, PUBLIC_CATALOG_FILE_NAME);
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }
    },

    async listManagedUserIndexFiles(rootFolderId) {
      const usersFolder = await getManagedIndexParentFolder(drive, rootFolderId, "user");
      if (!usersFolder) {
        return [];
      }

      const items: DriveItem[] = [];
      let pageToken: string | undefined;
      do {
        const page = await this.listFolderChildren(usersFolder.id, pageToken);
        items.push(
          ...page.items.filter(
            (item) =>
              item.name.startsWith(USER_INDEX_FILE_PREFIX) && item.name.endsWith(".sqlite")
          )
        );
        pageToken = page.nextPageToken;
      } while (pageToken);

      return items;
    },

    async listFolderChildren(folderId, pageToken) {
      let response;
      try {
        response = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          pageToken,
          pageSize: 100,
          fields: `nextPageToken,files(${DRIVE_FIELDS})`,
          orderBy: "folder,name",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }

      return {
        items: (response.data.files ?? []).map(mapDriveFile),
        nextPageToken: response.data.nextPageToken ?? undefined
      };
    },

    ensurePaperManagerFolder(rootFolderId) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      return getOrCreatePaperManagerFolder(drive, rootFolderId);
    },

    async uploadOrUpdateManagedIndex(rootFolderId, input) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }

      const folder = await getOrCreateManagedIndexParentFolder(drive, rootFolderId, input.kind);
      const existing = await findManagedIndexFile(drive, rootFolderId, {
        kind: input.kind,
        userId: input.userId
      });
      const media = {
        mimeType: "application/octet-stream",
        body: Readable.from(Buffer.from(input.bytes))
      };

      if (input.kind === "user" && !input.userId) {
        throw new AppError("INVALID_REQUEST", "userId is required for user indexes.", 400);
      }

      let fileId: string;

      if (existing) {
        const updated = await drive.files.update({
          fileId: existing.id,
          media,
          fields: "id",
          supportsAllDrives: true
        });
        fileId = updated.data.id ?? existing.id;
      } else {
        const created = await drive.files.create({
          requestBody: {
            name: getManagedIndexFileName(input.kind, input.userId),
            parents: [folder.id]
          },
          media,
          fields: "id",
          supportsAllDrives: true
        });
        fileId = created.data.id ?? randomUUID();
      }

      if (input.kind === "anyone") {
        await ensurePublicReadPermission(drive, fileId, true);
      } else if (input.kind === "user") {
        if (!input.shareWithUserEmail) {
          throw new AppError(
            "INVALID_REQUEST",
            "shareWithUserEmail is required for user indexes.",
            400
          );
        }
        await ensureUserReadPermission(drive, fileId, input.shareWithUserEmail);
      }

      return { fileId };
    },

    async downloadManagedIndex(rootFolderId, input) {
      const existing = await findManagedIndexFile(drive, rootFolderId, input);
      if (!existing) {
        return null;
      }

      return downloadDriveFileBytes(drive, existing.id);
    },

    async downloadFileBytes(fileId) {
      return downloadDriveFileBytes(drive, fileId);
    },

    async downloadFileText(fileId) {
      return downloadDriveFileText(drive, fileId);
    },

    async uploadOrUpdatePublicCatalog(json) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }

      const folder = await getOrCreatePublicRegistryFolder(drive);
      const existing = await findPublicCatalogFile(drive);
      const media = {
        mimeType: "application/json",
        body: Readable.from(json)
      };

      let fileId: string;
      if (existing) {
        const updated = await drive.files.update({
          fileId: existing.id,
          media,
          fields: "id",
          supportsAllDrives: true
        });
        fileId = updated.data.id ?? existing.id;
      } else {
        const created = await drive.files.create({
          requestBody: {
            name: PUBLIC_CATALOG_FILE_NAME,
            parents: [folder.id]
          },
          media,
          fields: "id",
          supportsAllDrives: true
        });
        fileId = created.data.id ?? randomUUID();
      }

      await ensurePublicReadPermission(drive, fileId, true);
      return { fileId };
    },

    async uploadOrUpdatePublicLibraryManifest(rootFolderId, json) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }

      const folder = await getOrCreatePaperManagerFolder(drive, rootFolderId);
      const existing = await findPublicLibraryManifestFile(drive, rootFolderId);
      const media = {
        mimeType: "application/json",
        body: Readable.from(json)
      };

      let fileId: string;
      if (existing) {
        const updated = await drive.files.update({
          fileId: existing.id,
          media,
          fields: "id",
          supportsAllDrives: true
        });
        fileId = updated.data.id ?? existing.id;
      } else {
        const created = await drive.files.create({
          requestBody: {
            name: PUBLIC_LIBRARY_MANIFEST_FILE_NAME,
            parents: [folder.id]
          },
          media,
          fields: "id",
          supportsAllDrives: true
        });
        fileId = created.data.id ?? randomUUID();
      }

      await ensurePublicReadPermission(drive, fileId, true);
      return { fileId };
    },

    async removePublicLibraryManifest(rootFolderId) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }

      const existing = await findPublicLibraryManifestFile(drive, rootFolderId);
      if (!existing) {
        return;
      }

      await drive.files.update({
        fileId: existing.id,
        requestBody: {
          trashed: true
        },
        fields: "id",
        supportsAllDrives: true
      });
    },

    async uploadOrUpdateIndexSqlite(rootFolderId, bytes) {
      return this.uploadOrUpdateManagedIndex(rootFolderId, {
        kind: "master",
        bytes
      });
    },

    async downloadIndexSqlite(rootFolderId) {
      return this.downloadManagedIndex(rootFolderId, { kind: "master" });
    },

    async readAppConfig() {
      if (accessMode === "public") {
        return null;
      }
      let existing: DriveItem | null;
      try {
        existing = await getAppConfigFile(drive);
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }
      if (!existing) {
        return null;
      }

      let response;
      try {
        response = await drive.files.get(
          {
            fileId: existing.id,
            alt: "media"
          },
          {
            responseType: "text"
          }
        );
      } catch (error) {
        throw toAuthenticationError(error) ?? error;
      }

      return String(response.data);
    },

    async writeAppConfig(json) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      const existing = await getAppConfigFile(drive);
      const media = {
        mimeType: "application/json",
        body: Readable.from(json)
      };

      if (existing) {
        await drive.files.update({
          fileId: existing.id,
          media,
          fields: "id"
        });
        return;
      }

      await drive.files.create({
        requestBody: {
          name: APP_DATA_CONFIG_NAME,
          parents: ["appDataFolder"]
        },
        media,
        fields: "id"
      });
    },

    async createFolder(parentFolderId, name) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      const response = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId]
        },
        fields: DRIVE_FIELDS,
        supportsAllDrives: true
      });

      return mapDriveFile(response.data);
    },

    async updateFolder(driveFolderId, updates) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      const current = await getMetadata(driveFolderId);
      const response = await drive.files.update({
        fileId: driveFolderId,
        requestBody: {
          name: updates.name ?? current.name
        },
        addParents: updates.newParentFolderId,
        removeParents:
          updates.newParentFolderId && current.parents?.length
            ? current.parents.join(",")
            : undefined,
        fields: DRIVE_FIELDS,
        supportsAllDrives: true
      });
      return mapDriveFile(response.data);
    },

    async trashFolder(driveFolderId) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      await drive.files.update({
        fileId: driveFolderId,
        requestBody: {
          trashed: true
        },
        fields: "id",
        supportsAllDrives: true
      });
    },

    async uploadPdf(parentFolderId, fileName, mimeType, bytes) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentFolderId]
        },
        media: {
          mimeType,
          body: Readable.from(Buffer.from(bytes))
        },
        fields: DRIVE_FIELDS,
        supportsAllDrives: true
      });
      return mapDriveFile(response.data);
    },

    async updatePaper(driveFileId, updates) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      const current = await getMetadata(driveFileId);
      const response = await drive.files.update({
        fileId: driveFileId,
        requestBody: {
          name: updates.fileName ?? current.name
        },
        addParents: updates.newParentFolderId,
        removeParents:
          updates.newParentFolderId && current.parents?.length
            ? current.parents.join(",")
            : undefined,
        fields: DRIVE_FIELDS,
        supportsAllDrives: true
      });
      return mapDriveFile(response.data);
    },

    async trashPaper(driveFileId) {
      if (accessMode === "public") {
        throw createReadOnlyDriveError();
      }
      await drive.files.update({
        fileId: driveFileId,
        requestBody: {
          trashed: true
        },
        fields: "id",
        supportsAllDrives: true
      });
    }
  };
}
