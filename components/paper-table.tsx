import React from "react";
import Link from "next/link";

import { IndexedPaper } from "@/lib/models";

export function PaperTable({
  papers,
  canEdit,
  libraryId,
  selectedPaperId
}: {
  papers: IndexedPaper[];
  canEdit: boolean;
  libraryId: string;
  selectedPaperId?: string;
}) {
  if (papers.length === 0) {
    return (
      <section className="finder-list-shell">
        <div className="empty-panel">
          <p className="muted">No papers match this folder yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="finder-list-shell">
      <table className="finder-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Date Modified</th>
            <th>Size</th>
            <th>Kind</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {papers.map((paper) => {
            const itemHref = `/library/${libraryId}?folder=${paper.driveFolderId}&paper=${paper.driveFileId}`;
            return (
              <tr
                className={`finder-row ${
                  selectedPaperId === paper.driveFileId ? "active" : ""
                }`}
                key={paper.driveFileId}
              >
                <td>
                  <Link className="finder-file-link" href={itemHref as never}>
                    <span className="finder-file-icon">PDF</span>
                    <span className="finder-file-copy">
                      <strong>{paper.title}</strong>
                      <span>{paper.fileName}</span>
                    </span>
                  </Link>
                </td>
                <td className="muted">
                  {paper.modifiedTime
                    ? new Date(paper.modifiedTime).toLocaleString()
                    : "Unknown"}
                </td>
                <td className="muted">
                  {paper.sizeBytes ? `${Math.round(paper.sizeBytes / 1024)} KB` : "--"}
                </td>
                <td className="muted">PDF Document</td>
                <td>
                  <div className="row-actions">
                    <details className="menu">
                      <summary aria-label={`Actions for ${paper.title}`}>•••</summary>
                      <div className="menu-popover">
                        <Link className="menu-link" href={itemHref as never}>
                          <span>Reveal in preview</span>
                        </Link>
                        <Link
                          className="menu-link"
                          href={`/library/${libraryId}/paper/${paper.driveFileId}`}
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
