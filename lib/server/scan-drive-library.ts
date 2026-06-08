import { DriveClient } from "@/lib/google/drive";
import { IndexedFolder, IndexedPaper, PaperAccessLevel, SharedDriveUser } from "@/lib/models";
import {
  buildFolderPath,
  buildPaperPath,
  isFolderMimeType,
  isPdfFile,
  titleFromFileName
} from "@/lib/utils/drive";

export interface ScanResult {
  folders: IndexedFolder[];
  papers: IndexedPaper[];
}

function getPaperAccessLevel(permissions?: Array<{
  id?: string;
  type?: string;
  role?: string;
  allowFileDiscovery?: boolean;
}>): PaperAccessLevel {
  const anyonePermission = permissions?.find(
    (permission) => permission.type === "anyone" && permission.role !== "none"
  );

  if (!anyonePermission) {
    return "restricted";
  }

  return anyonePermission.allowFileDiscovery ? "public_on_web" : "anyone_with_link";
}

function getSharedUsers(
  permissions?: Array<{
    id?: string;
    type?: string;
    role?: string;
    emailAddress?: string;
  }>
): SharedDriveUser[] {
  return (permissions ?? [])
    .filter(
      (permission): permission is { id: string; type?: string; role?: string; emailAddress?: string } =>
        permission.type === "user" && permission.role !== "none" && typeof permission.id === "string"
    )
    .map((permission) => ({
      id: permission.id,
      emailAddress: permission.emailAddress
    }));
}

export async function scanDriveLibrary(
  driveClient: DriveClient,
  rootFolderId: string
): Promise<ScanResult> {
  const root = await driveClient.getFileMetadata(rootFolderId);
  const indexedAt = new Date().toISOString();
  const folders: IndexedFolder[] = [
    {
      driveFolderId: root.id,
      parentFolderId: null,
      name: root.name,
      path: "/",
      depth: 0,
      modifiedTime: root.modifiedTime,
      createdTime: root.createdTime,
      accessLevel: getPaperAccessLevel(root.permissions),
      sharedUsers: getSharedUsers(root.permissions)
    }
  ];
  const papers: IndexedPaper[] = [];
  const queue: Array<{
    id: string;
    path: string;
    depth: number;
    parentFolderId: string;
  }> = [{ id: root.id, path: "/", depth: 0, parentFolderId: root.id }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    let pageToken: string | undefined;

    do {
      const page = await driveClient.listFolderChildren(current.id, pageToken);

      for (const child of page.items) {
        if (isFolderMimeType(child.mimeType)) {
          if (child.name === ".paper-manager") {
            continue;
          }

          const childPath = buildFolderPath(current.path, child.name);
          folders.push({
            driveFolderId: child.id,
            parentFolderId: current.id,
            name: child.name,
            path: childPath,
            depth: current.depth + 1,
            modifiedTime: child.modifiedTime,
            createdTime: child.createdTime,
            accessLevel: getPaperAccessLevel(child.permissions),
            sharedUsers: getSharedUsers(child.permissions)
          });
          queue.push({
            id: child.id,
            path: childPath,
            depth: current.depth + 1,
            parentFolderId: current.id
          });
          continue;
        }

        if (!isPdfFile(child.mimeType, child.name)) {
          continue;
        }

        papers.push({
          driveFileId: child.id,
          driveFolderId: current.id,
          title: titleFromFileName(child.name),
          fileName: child.name,
          path: buildPaperPath(current.path, child.name),
          mimeType: child.mimeType,
          modifiedTime: child.modifiedTime,
          createdTime: child.createdTime,
          sizeBytes: child.size,
          webViewLink: child.webViewLink,
          accessLevel: getPaperAccessLevel(child.permissions),
          indexedAt,
          sharedUsers: getSharedUsers(child.permissions)
        });
      }

      pageToken = page.nextPageToken;
    } while (pageToken);
  }

  return { folders, papers };
}
