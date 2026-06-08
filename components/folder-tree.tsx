"use client";

import React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

import { ExplorerFolder, IndexedFolder } from "@/lib/models";

type FolderAction = (formData: FormData) => void | Promise<void>;

function getAncestorIds(
  folders: IndexedFolder[],
  currentFolderId?: string
): Set<string> {
  const byId = new Map(folders.map((folder) => [folder.driveFolderId, folder]));
  const expanded = new Set<string>();
  let cursor = currentFolderId ? byId.get(currentFolderId) : undefined;

  while (cursor) {
    expanded.add(cursor.driveFolderId);
    cursor = cursor.parentFolderId ? byId.get(cursor.parentFolderId) : undefined;
  }

  return expanded;
}

export function FolderTree({
  folders,
  pageMode,
  libraryId,
  currentFolderId,
  query,
  canEdit,
  emptyMessage,
  createFolderAction,
  rebuildAction,
  uploadAction,
  updateFolderAction,
  trashFolderAction
}: {
  folders: Array<IndexedFolder | ExplorerFolder>;
  pageMode: "root" | "library";
  libraryId?: string;
  currentFolderId?: string;
  query?: string;
  canEdit: boolean;
  emptyMessage?: string;
  createFolderAction?: FolderAction;
  rebuildAction?: FolderAction;
  uploadAction?: FolderAction;
  updateFolderAction?: FolderAction;
  trashFolderAction?: FolderAction;
}) {
  const rootFolders = folders.filter((folder) => folder.parentFolderId === null);
  const treeFolders = folders.filter((folder) => folder.parentFolderId !== null);
  const childrenByParent = useMemo(() => {
    const next = new Map<string, IndexedFolder[]>();
    for (const folder of treeFolders) {
      const bucket = next.get(folder.parentFolderId ?? "") ?? [];
      bucket.push(folder);
      next.set(folder.parentFolderId ?? "", bucket);
    }
    return next;
  }, [treeFolders]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(getAncestorIds(folders, currentFolderId))
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0
  });
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setExpanded((current) => new Set([...current, ...getAncestorIds(folders, currentFolderId)]));
  }, [folders, currentFolderId]);

  useEffect(() => {
    setOpenMenuId(null);
  }, [currentFolderId, query]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const trigger = triggerRefs.current[openMenuId];
      if (menuRef.current?.contains(target) || trigger?.contains(target)) {
        return;
      }
      setOpenMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  useLayoutEffect(() => {
    if (!openMenuId) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRefs.current[openMenuId];
      const menu = menuRef.current;
      if (!trigger || !menu) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 8;

      let left = rect.right - menuRect.width;
      let top = rect.bottom + gap;

      if (left < gap) {
        left = gap;
      }
      if (left + menuRect.width > viewportWidth - gap) {
        left = viewportWidth - menuRect.width - gap;
      }
      if (top + menuRect.height > viewportHeight - gap) {
        top = rect.top - menuRect.height - gap;
      }
      if (top < gap) {
        top = gap;
      }

      setMenuPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [openMenuId]);

  if (rootFolders.length === 0) {
    return <p className="muted">{emptyMessage ?? "No indexed folders."}</p>;
  }

  const toggle = (folderId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const hrefForFolder = (folder: IndexedFolder | ExplorerFolder) => {
    if (pageMode === "root") {
      return `/?folder=${folder.driveFolderId}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
    }

    const targetLibraryId = libraryId ?? ("libraryId" in folder ? folder.libraryId : folder.driveFolderId);
    if (folder.driveFolderId === targetLibraryId) {
      return `/library/${targetLibraryId}${query ? `?q=${encodeURIComponent(query)}` : ""}`;
    }

    return `/library/${targetLibraryId}?folder=${folder.driveFolderId}${
      query ? `&q=${encodeURIComponent(query)}` : ""
    }`;
  };

  const closeMenu = () => setOpenMenuId(null);

  const renderFolderMenu = (
    folder: IndexedFolder | ExplorerFolder,
    folderLibraryId: string,
    moveOptions: Array<IndexedFolder | ExplorerFolder>,
    kind: "root" | "child"
  ) => {
    if (!createFolderAction || !updateFolderAction || !trashFolderAction) {
      return null;
    }

    const isRoot = kind === "root";

    return (
      <>
        <button
          aria-expanded={openMenuId === folder.driveFolderId}
          aria-haspopup="menu"
          aria-label={`Folder actions for ${folder.name}`}
          className="tree-menu-trigger"
          onClick={() =>
            setOpenMenuId((current) => (current === folder.driveFolderId ? null : folder.driveFolderId))
          }
          ref={(node) => {
            triggerRefs.current[folder.driveFolderId] = node;
          }}
          title="Folder actions"
          type="button"
        >
          {isRoot ? "+" : "•••"}
        </button>
        {openMenuId === folder.driveFolderId
          ? createPortal(
              <div
                className="menu-popover tree-menu-popover tree-menu-popover-floating"
                ref={menuRef}
                style={{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px` }}
              >
                <form action={createFolderAction}>
                  <input name="libraryId" type="hidden" value={folderLibraryId} />
                  <input name="parentFolderId" type="hidden" value={folder.driveFolderId} />
                  <input name="name" type="hidden" value="New Folder" />
                  <button className="menu-button" onClick={closeMenu} type="submit">
                    <span>New subfolder</span>
                  </button>
                </form>
                <form action={updateFolderAction} className="stack-sm">
                  <input name="libraryId" type="hidden" value={folderLibraryId} />
                  <input name="driveFolderId" type="hidden" value={folder.driveFolderId} />
                  <div className="field compact-field">
                    <label htmlFor={`folder-name-${folder.driveFolderId}`}>Rename</label>
                    <input
                      defaultValue={folder.name}
                      id={`folder-name-${folder.driveFolderId}`}
                      name="name"
                    />
                  </div>
                  {!isRoot ? (
                    <div className="field compact-field">
                      <label htmlFor={`folder-parent-${folder.driveFolderId}`}>Move to</label>
                      <select
                        defaultValue={folder.parentFolderId ?? folder.driveFolderId}
                        id={`folder-parent-${folder.driveFolderId}`}
                        name="newParentFolderId"
                      >
                        {moveOptions.map((candidate) => (
                          <option key={candidate.driveFolderId} value={candidate.driveFolderId}>
                            {candidate.depth === 0
                              ? candidate.name
                              : `${"  ".repeat(candidate.depth)}${candidate.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <button className="button button-secondary" onClick={closeMenu} type="submit">
                    Save folder
                  </button>
                </form>
                {isRoot && uploadAction && rebuildAction ? (
                  <>
                    <form action={uploadAction}>
                      <input name="libraryId" type="hidden" value={folderLibraryId} />
                      <input
                        name="parentFolderId"
                        type="hidden"
                        value={currentFolderId ?? folder.driveFolderId}
                      />
                      <label className="menu-file-picker">
                        <span>Upload PDF</span>
                        <input accept=".pdf,application/pdf" name="file" required type="file" />
                      </label>
                      <button className="menu-button" onClick={closeMenu} type="submit">
                        <span>Upload to current folder</span>
                      </button>
                    </form>
                    <form action={rebuildAction}>
                      <input name="libraryId" type="hidden" value={folderLibraryId} />
                      <button className="menu-button" onClick={closeMenu} type="submit">
                        <span>Refresh index</span>
                      </button>
                    </form>
                  </>
                ) : null}
                <form action={trashFolderAction}>
                  <input name="libraryId" type="hidden" value={folderLibraryId} />
                  <input name="driveFolderId" type="hidden" value={folder.driveFolderId} />
                  <button className="menu-button danger" onClick={closeMenu} type="submit">
                    <span>Delete folder</span>
                  </button>
                </form>
              </div>,
              document.body
            )
          : null}
      </>
    );
  };

  const renderNode = (folder: IndexedFolder | ExplorerFolder) => {
    const children = childrenByParent.get(folder.driveFolderId) ?? [];
    const isExpanded = expanded.has(folder.driveFolderId) || folder.driveFolderId === currentFolderId;
    const href = hrefForFolder(folder);
    const folderLibraryId = "libraryId" in folder ? folder.libraryId : libraryId ?? folder.driveFolderId;
    const folderCanEdit = "libraryCanEdit" in folder ? folder.libraryCanEdit : canEdit;
    const moveOptions = folders.filter(
      (candidate) =>
        candidate.driveFolderId !== folder.driveFolderId &&
        !candidate.path.startsWith(`${folder.path}/`)
    );

        return (
      <li className="tree-node" key={folder.driveFolderId}>
        <div
          className="tree-row"
          onContextMenu={(event) => {
            if (!folderCanEdit) {
              return;
            }
            event.preventDefault();
            setOpenMenuId(folder.driveFolderId);
          }}
        >
          <button
            aria-label={children.length ? (isExpanded ? "Collapse folder" : "Expand folder") : "No children"}
            className="tree-toggle"
            disabled={children.length === 0}
            onClick={() => toggle(folder.driveFolderId)}
            type="button"
          >
            {children.length ? (isExpanded ? "▾" : "▸") : "•"}
          </button>
          <Link
            className={`tree-link ${currentFolderId === folder.driveFolderId ? "active" : ""}`}
            href={href as never}
          >
            <span className="tree-label">{folder.name}</span>
          </Link>
          {folderCanEdit ? renderFolderMenu(folder, folderLibraryId, moveOptions, "child") : null}
        </div>
        {children.length > 0 && isExpanded ? (
          <ul className="tree">{children.map((child) => renderNode(child))}</ul>
        ) : null}
      </li>
    );
  };

  const renderRootNode = (root: IndexedFolder | ExplorerFolder) => {
    const rootLibraryId =
      "libraryId" in root ? root.libraryId : libraryId ?? root.driveFolderId;
    const rootCanEdit = "libraryCanEdit" in root ? root.libraryCanEdit : canEdit;

    return (
      <li className="tree-node" key={root.driveFolderId}>
          <div
            className="tree-row"
            onContextMenu={(event) => {
              if (!rootCanEdit) {
                return;
              }
              event.preventDefault();
              setOpenMenuId(root.driveFolderId);
            }}
          >
            <button
              aria-label={expanded.has(root.driveFolderId) ? "Collapse folder" : "Expand folder"}
              className="tree-toggle"
              onClick={() => toggle(root.driveFolderId)}
              type="button"
            >
              {expanded.has(root.driveFolderId) ? "▾" : "▸"}
            </button>
            <Link
              className={`tree-link ${currentFolderId === root.driveFolderId ? "active" : ""}`}
              href={hrefForFolder(root) as never}
            >
              <span className="tree-label">{root.name}</span>
            </Link>
            {rootCanEdit ? renderFolderMenu(root, rootLibraryId, [], "root") : null}
          </div>
          {expanded.has(root.driveFolderId) ? (
            <ul className="tree">{(childrenByParent.get(root.driveFolderId) ?? []).map((child) => renderNode(child))}</ul>
          ) : null}
        </li>
    );
  };

  return (
    <nav className="stack-sm">
      <ul className="tree tree-root">
        {rootFolders.map((root) => renderRootNode(root))}
      </ul>
    </nav>
  );
}
