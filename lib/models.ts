export interface DriveCapabilities {
  canEdit?: boolean;
  canAddChildren?: boolean;
  canDelete?: boolean;
  canTrash?: boolean;
  canRename?: boolean;
  canMoveItemWithinDrive?: boolean;
}

export interface DrivePermission {
  type?: string;
  role?: string;
  allowFileDiscovery?: boolean;
}

export type PaperAccessLevel = "restricted" | "anyone_with_link" | "public_on_web";

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  createdTime?: string;
  size?: number;
  webViewLink?: string;
  capabilities?: DriveCapabilities;
  permissions?: DrivePermission[];
}

export interface IndexedFolder {
  driveFolderId: string;
  parentFolderId: string | null;
  name: string;
  path: string;
  depth: number;
  modifiedTime?: string;
  createdTime?: string;
}

export interface IndexedPaper {
  driveFileId: string;
  driveFolderId: string;
  title: string;
  fileName: string;
  path: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  sizeBytes?: number;
  webViewLink?: string;
  accessLevel: PaperAccessLevel;
  indexedAt: string;
}

export interface LibraryRecord {
  id: string;
  driveFolderId: string;
  displayName?: string;
  addedAt: string;
  cachedPaperCount?: number;
  cachedFolderCount?: number;
  cachedGeneratedAt?: string;
}

export interface LibraryConfig {
  version: number;
  updatedAt: string;
  libraries: LibraryRecord[];
}

export interface LibrarySummary {
  id: string;
  name: string;
  driveFolderId: string;
  accessible: boolean;
  canEdit: boolean;
  canAddChildren: boolean;
  webViewLink?: string;
  indexStatus: "ok" | "missing" | "error";
  generatedAt?: string;
  paperCount?: number;
  folderCount?: number;
}

export interface LibraryIndexData {
  generatedAt?: string;
  folders: IndexedFolder[];
  papers: IndexedPaper[];
}

export interface SearchResult extends IndexedPaper {}

export interface ExplorerFolder extends IndexedFolder {
  libraryId: string;
  libraryName: string;
  libraryCanEdit: boolean;
}

export interface ExplorerPaper extends IndexedPaper {
  libraryId: string;
  libraryName: string;
}
