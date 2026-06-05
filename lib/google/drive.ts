import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { Session } from "next-auth";

import { AppError } from "@/lib/errors";
import { DriveItem } from "@/lib/models";

const DRIVE_FIELDS = [
  "id",
  "name",
  "mimeType",
  "parents",
  "modifiedTime",
  "createdTime",
  "size",
  "webViewLink",
  "capabilities(canEdit,canAddChildren,canDelete,canTrash,canRename,canMoveItemWithinDrive)"
].join(",");

const APP_DATA_CONFIG_NAME = "papershelf-config.json";

export interface DriveClient {
  getFileMetadata(fileId: string): Promise<DriveItem>;
  listFolderChildren(
    folderId: string,
    pageToken?: string
  ): Promise<{ items: DriveItem[]; nextPageToken?: string }>;
  ensurePaperManagerFolder(rootFolderId: string): Promise<DriveItem>;
  uploadOrUpdateIndexSqlite(
    rootFolderId: string,
    bytes: Uint8Array
  ): Promise<{ fileId: string }>;
  downloadIndexSqlite(rootFolderId: string): Promise<Uint8Array | null>;
  readAppConfig(): Promise<string | null>;
  writeAppConfig(json: string): Promise<void>;
  createFolder(parentFolderId: string, name: string): Promise<DriveItem>;
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
      : undefined
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

async function findIndexFile(
  drive: drive_v3.Drive,
  paperManagerFolderId: string
): Promise<DriveItem | null> {
  return findChildByName(drive, paperManagerFolderId, "index.sqlite");
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
  const accessToken = session.user.accessToken;
  if (!accessToken) {
    throw new AppError(
      "NOT_AUTHENTICATED",
      "Google access token missing from session. Please sign in again.",
      401
    );
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: "v3", auth });
  const getMetadata = async (fileId: string) => {
    try {
      const response = await drive.files.get({
        fileId,
        fields: DRIVE_FIELDS,
        supportsAllDrives: true
      });
      return mapDriveFile(response.data);
    } catch {
      throw new AppError("DRIVE_NOT_FOUND", "Drive item not found.", 404);
    }
  };

  return {
    getFileMetadata: getMetadata,

    async listFolderChildren(folderId, pageToken) {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        pageToken,
        pageSize: 100,
        fields: `nextPageToken,files(${DRIVE_FIELDS})`,
        orderBy: "folder,name",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      return {
        items: (response.data.files ?? []).map(mapDriveFile),
        nextPageToken: response.data.nextPageToken ?? undefined
      };
    },

    ensurePaperManagerFolder(rootFolderId) {
      return getOrCreatePaperManagerFolder(drive, rootFolderId);
    },

    async uploadOrUpdateIndexSqlite(rootFolderId, bytes) {
      const folder = await getOrCreatePaperManagerFolder(drive, rootFolderId);
      const existing = await findIndexFile(drive, folder.id);
      const media = {
        mimeType: "application/octet-stream",
        body: Readable.from(Buffer.from(bytes))
      };

      if (existing) {
        const updated = await drive.files.update({
          fileId: existing.id,
          media,
          fields: "id",
          supportsAllDrives: true
        });
        return { fileId: updated.data.id ?? existing.id };
      }

      const created = await drive.files.create({
        requestBody: {
          name: "index.sqlite",
          parents: [folder.id]
        },
        media,
        fields: "id",
        supportsAllDrives: true
      });
      return { fileId: created.data.id ?? randomUUID() };
    },

    async downloadIndexSqlite(rootFolderId) {
      const folder = await getOrCreatePaperManagerFolder(drive, rootFolderId);
      const existing = await findIndexFile(drive, folder.id);
      if (!existing) {
        return null;
      }

      const response = await drive.files.get(
        {
          fileId: existing.id,
          alt: "media",
          supportsAllDrives: true
        },
        {
          responseType: "arraybuffer"
        }
      );

      return new Uint8Array(response.data as ArrayBuffer);
    },

    async readAppConfig() {
      const existing = await getAppConfigFile(drive);
      if (!existing) {
        return null;
      }

      const response = await drive.files.get(
        {
          fileId: existing.id,
          alt: "media"
        },
        {
          responseType: "text"
        }
      );

      return String(response.data);
    },

    async writeAppConfig(json) {
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

    async uploadPdf(parentFolderId, fileName, mimeType, bytes) {
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
