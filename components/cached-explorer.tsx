"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { FolderTree } from "@/components/folder-tree";
import { PaperTable } from "@/components/paper-table";
import { ViewModeSwitcher } from "@/components/view-mode-switcher";
import {
  ExplorerSnapshot,
  readExplorerSnapshot,
  writeExplorerSnapshot
} from "@/lib/client/explorer-cache";
import { ExplorerFolder } from "@/lib/models";

type FolderAction = (formData: FormData) => void | Promise<void>;

function previewUrlForPaper(driveFileId: string) {
  return `https://drive.google.com/file/d/${driveFileId}/preview`;
}

function collectDescendantFolderIds(folders: ExplorerFolder[], rootFolderId?: string): Set<string> {
  if (!rootFolderId) return new Set(folders.map((folder) => folder.driveFolderId));
  const byParent = new Map<string, string[]>();
  for (const folder of folders) {
    const bucket = byParent.get(folder.parentFolderId ?? "") ?? [];
    bucket.push(folder.driveFolderId);
    byParent.set(folder.parentFolderId ?? "", bucket);
  }
  const visible = new Set<string>();
  const queue = [rootFolderId];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visible.has(current)) continue;
    visible.add(current);
    queue.push(...(byParent.get(current) ?? []));
  }
  return visible;
}

export function CachedExplorer({
  cacheKey,
  canManageLibraries,
  canRebuild,
  layoutMode,
  createFolderAction,
  rebuildAction,
  trashFolderAction,
  updateFolderAction,
  uploadAction
}: {
  cacheKey: string;
  canManageLibraries: boolean;
  canRebuild: boolean;
  layoutMode: "list" | "split";
  createFolderAction?: FolderAction;
  rebuildAction?: FolderAction;
  trashFolderAction?: FolderAction;
  updateFolderAction?: FolderAction;
  uploadAction?: FolderAction;
}) {
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ExplorerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const response = await fetch("/api/explorer", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Unable to refresh your library.");
    const next = { ...(await response.json()), cachedAt: new Date().toISOString() } as ExplorerSnapshot;
    setSnapshot(next);
    await writeExplorerSnapshot(cacheKey, next);
  };

  useEffect(() => {
    let active = true;
    void readExplorerSnapshot(cacheKey)
      .then((cached) => {
        if (active && cached) setSnapshot(cached);
      })
      .catch(() => undefined)
      .finally(() => {
        void refresh().catch((cause: unknown) => {
          if (active && !snapshot) setError(cause instanceof Error ? cause.message : "Unable to load your library.");
        });
      });
    return () => { active = false; };
    // A cache identity change must load a completely separate visibility scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const wrapAction = (action?: FolderAction): FolderAction | undefined => action
    ? async (formData) => { await action(formData); await refresh(); }
    : undefined;

  const folderId = searchParams.get("folder") ?? undefined;
  const selectedPaperId = searchParams.get("paper") ?? undefined;
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const visibleFolderIds = useMemo(
    () => collectDescendantFolderIds(snapshot?.folders ?? [], folderId),
    [folderId, snapshot?.folders]
  );
  const visiblePapers = (snapshot?.papers ?? []).filter((paper) =>
    (!folderId || visibleFolderIds.has(paper.driveFolderId)) &&
    (!query || [paper.title, paper.fileName, paper.path, paper.libraryName].join(" ").toLowerCase().includes(query))
  );
  const selectedFolder = snapshot?.folders.find((folder) => folder.driveFolderId === folderId);
  const selectedPaper = selectedPaperId
    ? visiblePapers.find((paper) => paper.driveFileId === selectedPaperId) ?? snapshot?.papers.find((paper) => paper.driveFileId === selectedPaperId)
    : undefined;

  if (!snapshot) {
    return <main className="workspace workspace-finder"><section className="card glass-card stack"><p className="muted">{error ?? "Loading your library…"}</p></section></main>;
  }

  return <main className="workspace workspace-finder">
    <section className={`finder-layout ${layoutMode === "list" ? "finder-layout-list" : ""}`}>
      <aside className="finder-sidebar"><div className="pane-header finder-sidebar-header"><div className="pane-title"><p className="eyebrow finder-sidebar-eyebrow">Library</p></div></div>
        <FolderTree canEdit={canManageLibraries} createFolderAction={wrapAction(createFolderAction)} currentFolderId={folderId} folders={snapshot.folders} pageMode="root" query={query} rebuildAction={canRebuild ? wrapAction(rebuildAction) : undefined} trashFolderAction={wrapAction(trashFolderAction)} updateFolderAction={wrapAction(updateFolderAction)} uploadAction={wrapAction(uploadAction)} />
      </aside>
      <section className="finder-main"><div className="finder-section-head"><div className="title-cluster"><p className="eyebrow">Collection</p><h2>{selectedFolder ? selectedFolder.name : "All Libraries"}</h2></div><div className="mini-actions"><ViewModeSwitcher value={layoutMode} /></div></div>
        <PaperTable canEdit={false} papers={visiblePapers} selectedPaperId={selectedPaper?.driveFileId} selectedFolderId={selectedFolder?.driveFolderId} showLibraryName query={query} viewMode={layoutMode} />
      </section>
      {layoutMode === "split" ? <aside className="finder-preview">{selectedPaper ? <div className="preview-shell"><div className="preview-header"><div className="preview-title"><strong>{selectedPaper.title}</strong><span>{selectedPaper.libraryName} · {selectedPaper.fileName}</span></div><div className="mini-actions"><Link className="button button-secondary" href={`/library/${selectedPaper.libraryId}/paper/${selectedPaper.driveFileId}`}>Open</Link>{selectedPaper.webViewLink ? <a className="button button-ghost" href={selectedPaper.webViewLink} rel="noreferrer" target="_blank">Drive</a> : null}</div></div><iframe className="preview-frame" src={previewUrlForPaper(selectedPaper.driveFileId)} title={selectedPaper.title} /></div> : <div className="preview-empty"><strong>Preview</strong><span className="muted">Select a paper from the list to preview it here.</span></div>}</aside> : null}
    </section>
  </main>;
}
