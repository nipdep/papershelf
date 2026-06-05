export function parseDriveFolderInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return match[1];
  }

  return trimmed;
}

export function buildFolderPath(parentPath: string, name: string): string {
  const safeParent = parentPath === "/" ? "" : parentPath;
  return `${safeParent}/${name}`;
}

export function buildPaperPath(folderPath: string, fileName: string): string {
  const safeFolder = folderPath === "/" ? "" : folderPath;
  return `${safeFolder}/${fileName}`;
}

export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").replace(/_+/g, " ").trim();
}

export function isPdfFile(mimeType: string, name: string): boolean {
  return mimeType === "application/pdf" || /\.pdf$/i.test(name);
}

export function isFolderMimeType(mimeType: string): boolean {
  return mimeType === "application/vnd.google-apps.folder";
}
