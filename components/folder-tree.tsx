import React from "react";
import Link from "next/link";

import { IndexedFolder } from "@/lib/models";

function renderBranch(
  folders: IndexedFolder[],
  parentFolderId: string | null,
  libraryId: string,
  currentFolderId?: string,
  query?: string
): React.ReactNode {
  const children = folders.filter((folder) => folder.parentFolderId === parentFolderId);
  if (children.length === 0) {
    return null;
  }

  return (
    <ul className="tree">
      {children.map((folder) => (
        <li key={folder.driveFolderId}>
          <Link
            className={`tree-link ${currentFolderId === folder.driveFolderId ? "active" : ""}`}
            href={`/library/${libraryId}?folder=${folder.driveFolderId}${
              query ? `&q=${encodeURIComponent(query)}` : ""
            }`}
          >
            <span className="tree-label">
              <span className="tree-icon">▸</span>
              <span>{folder.name}</span>
            </span>
          </Link>
          {renderBranch(folders, folder.driveFolderId, libraryId, currentFolderId, query)}
        </li>
      ))}
    </ul>
  );
}

export function FolderTree(props: {
  folders: IndexedFolder[];
  libraryId: string;
  currentFolderId?: string;
  query?: string;
}) {
  const root = props.folders.find((folder) => folder.parentFolderId === null);
  if (!root) {
    return <p className="muted">No indexed folders.</p>;
  }

  return (
    <nav className="stack-sm">
      {renderBranch(
        props.folders,
        root.driveFolderId,
        props.libraryId,
        props.currentFolderId,
        props.query
      )}
    </nav>
  );
}
