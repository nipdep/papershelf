import React from "react";
import Link from "next/link";

import { IndexedFolder } from "@/lib/models";

function renderBranch(
  folders: IndexedFolder[],
  parentFolderId: string | null,
  libraryId: string,
  currentFolderId?: string
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
            href={`/library/${libraryId}?folder=${folder.driveFolderId}`}
          >
            <span>{folder.depth === 0 ? "All papers" : folder.name}</span>
            <span className="tree-meta">{folder.depth === 0 ? "/" : folder.depth}</span>
          </Link>
          {renderBranch(folders, folder.driveFolderId, libraryId, currentFolderId)}
        </li>
      ))}
    </ul>
  );
}

export function FolderTree(props: {
  folders: IndexedFolder[];
  libraryId: string;
  currentFolderId?: string;
}) {
  const root = props.folders.find((folder) => folder.parentFolderId === null);
  if (!root) {
    return <p className="muted">No indexed folders.</p>;
  }

  return (
    <nav className="stack-sm">
      {renderBranch(props.folders, null, props.libraryId, props.currentFolderId)}
    </nav>
  );
}
