"use client";

import React from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import { ExplorerPaper } from "@/lib/models";

type SortKey = "name" | "library" | "modified" | "size" | "kind";
type SortDirection = "asc" | "desc";

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getParentFolderName(paper: ExplorerPaper) {
  const normalizedPath = paper.path.trim();
  if (!normalizedPath) {
    return paper.libraryName;
  }

  const expectedSuffix = `/${paper.fileName}`;
  const folderPath = normalizedPath.endsWith(expectedSuffix)
    ? normalizedPath.slice(0, -expectedSuffix.length)
    : normalizedPath;
  const segments = folderPath.split("/").filter(Boolean);

  return segments.at(-1) ?? paper.libraryName;
}

function sortPapers(
  papers: ExplorerPaper[],
  sortKey: SortKey | null,
  sortDirection: SortDirection | null
) {
  if (!sortKey || !sortDirection) {
    return papers;
  }

  const factor = sortDirection === "asc" ? 1 : -1;
  return [...papers].sort((left, right) => {
    let result = 0;

    switch (sortKey) {
      case "name":
        result = compareText(left.title, right.title);
        break;
      case "library":
        result = compareText(left.libraryName, right.libraryName);
        break;
      case "modified":
        result =
          new Date(left.modifiedTime ?? 0).getTime() -
          new Date(right.modifiedTime ?? 0).getTime();
        break;
      case "size":
        result = (left.sizeBytes ?? 0) - (right.sizeBytes ?? 0);
        break;
      case "kind":
        result = compareText(getParentFolderName(left), getParentFolderName(right));
        break;
    }

    if (result === 0) {
      result = compareText(left.title, right.title);
    }

    return result * factor;
  });
}

export function PaperTable({
  papers,
  canEdit,
  selectedPaperId,
  viewMode,
  selectedFolderId,
  query,
  showLibraryName,
  emptyMessage
}: {
  papers: ExplorerPaper[];
  canEdit: boolean;
  selectedPaperId?: string;
  viewMode: "list" | "split";
  selectedFolderId?: string;
  query?: string;
  showLibraryName?: boolean;
  emptyMessage?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    name: 360,
    library: 180,
    modified: 220,
    size: 120,
    kind: 150
  });
  const dragState = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const sortedPapers = useMemo(
    () => sortPapers(papers, sortKey, sortDirection),
    [papers, sortDirection, sortKey]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }

    if (sortDirection === "desc") {
      setSortKey(null);
      setSortDirection(null);
      return;
    }

    setSortDirection("asc");
  };

  const startResize = (key: string, clientX: number) => {
    dragState.current = {
      key,
      startX: clientX,
      startWidth: columnWidths[key] ?? 160
    };

    const handleMove = (event: MouseEvent) => {
      if (!dragState.current) {
        return;
      }

      const nextWidth = Math.max(
        dragState.current.startWidth + event.clientX - dragState.current.startX,
        90
      );
      setColumnWidths((current) => ({
        ...current,
        [dragState.current!.key]: nextWidth
      }));
    };

    const handleUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  if (papers.length === 0) {
    return (
      <section className="finder-list-shell">
        <div className="empty-panel">
          <p className="muted">{emptyMessage ?? "No papers match this folder yet."}</p>
        </div>
      </section>
    );
  }

  const header = (key: SortKey, label: string, widthKey: string) => (
    <th style={{ width: columnWidths[widthKey] }}>
      <button className="table-sort-button" onClick={() => toggleSort(key)} type="button">
        <span>{label}</span>
        <span className="table-sort-indicator">
          {sortKey === key ? (sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "↕") : "↕"}
        </span>
      </button>
      <span
        className="table-resizer"
        onMouseDown={(event) => {
          event.preventDefault();
          startResize(widthKey, event.clientX);
        }}
      />
    </th>
  );

  return (
    <section className="finder-list-shell">
      <table className="finder-table">
        <thead>
          <tr>
            {header("name", "Name", "name")}
            {showLibraryName ? header("library", "Library", "library") : null}
            {header("kind", "Folder", "kind")}
            {header("modified", "Date Modified", "modified")}
            {header("size", "Size", "size")}
            <th />
          </tr>
        </thead>
        <tbody>
          {sortedPapers.map((paper) => {
            const itemHref =
              viewMode === "split"
                ? `/?${selectedFolderId ? `folder=${selectedFolderId}&` : ""}paper=${
                    paper.driveFileId
                  }${query ? `&q=${encodeURIComponent(query)}` : ""}`
                : `/library/${paper.libraryId}/paper/${paper.driveFileId}`;
            return (
              <tr
                className={`finder-row ${selectedPaperId === paper.driveFileId ? "active" : ""}`}
                key={paper.driveFileId}
              >
                <td style={{ width: columnWidths.name }}>
                  <Link className="finder-file-link" href={itemHref as never}>
                    <span className="finder-file-copy">
                      <strong>{paper.title}</strong>
                      <span>{paper.fileName}</span>
                    </span>
                  </Link>
                </td>
                {showLibraryName ? (
                  <td className="muted" style={{ width: columnWidths.library }}>
                    {paper.libraryName}
                  </td>
                ) : null}
                <td className="muted" style={{ width: columnWidths.kind }}>
                  {getParentFolderName(paper)}
                </td>
                <td className="muted" style={{ width: columnWidths.modified }}>
                  {paper.modifiedTime ? new Date(paper.modifiedTime).toLocaleString() : "Unknown"}
                </td>
                <td className="muted" style={{ width: columnWidths.size }}>
                  {paper.sizeBytes ? `${Math.round(paper.sizeBytes / 1024)} KB` : "--"}
                </td>
                <td>
                  <div className="row-actions">
                    <details className="menu">
                      <summary aria-label={`Actions for ${paper.title}`}>•••</summary>
                      <div className="menu-popover">
                        <Link className="menu-link" href={itemHref as never}>
                          <span>{viewMode === "split" ? "Reveal in preview" : "Open paper"}</span>
                        </Link>
                        <Link
                          className="menu-link"
                          href={`/library/${paper.libraryId}/paper/${paper.driveFileId}`}
                        >
                          <span>Open full preview</span>
                        </Link>
                        {paper.webViewLink ? (
                          <a
                            className="menu-link"
                            href={paper.webViewLink}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span>Open in Drive</span>
                          </a>
                        ) : null}
                        {canEdit ? (
                          <div className="menu-link">
                            <span>Manage from preview pane</span>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
