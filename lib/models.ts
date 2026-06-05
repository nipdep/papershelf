export interface DriveCapabilities {
  canEdit?: boolean;
  canAddChildren?: boolean;
  canDelete?: boolean;
  canTrash?: boolean;
  canRename?: boolean;
  canMoveItemWithinDrive?: boolean;
}

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
  indexedAt: string;
}

export interface LibraryRecord {
  id: string;
  driveFolderId: string;
  displayName?: string;
  addedAt: string;
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
}

export interface LibraryIndexData {
  generatedAt?: string;
  folders: IndexedFolder[];
  papers: IndexedPaper[];
}

export interface SearchResult extends IndexedPaper {}
