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
      <section className="surface empty-panel">
        <p className="muted">No papers match this view yet.</p>
      </section>
    );
  }

  return (
    <section className="pane">
      <div className="pane-header">
        <div className="pane-title">
          <strong>Papers</strong>
          <span className="muted">
            {papers.length} item{papers.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <table className="paper-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Path</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {papers.map((paper) => {
            const itemHref = `/library/${libraryId}?folder=${paper.driveFolderId}&paper=${paper.driveFileId}`;
            return (
              <tr
                className={`paper-row ${
                  selectedPaperId === paper.driveFileId ? "active" : ""
                }`}
                key={paper.driveFileId}
              >
                <td>
                  <Link className="paper-title-link" href={itemHref as never}>
                    <strong>{paper.title}</strong>
                    <span className="paper-subtitle">{paper.fileName}</span>
                  </Link>
                </td>
                <td className="muted">{paper.path}</td>
                <td className="muted">
                  {paper.modifiedTime
                    ? new Date(paper.modifiedTime).toLocaleDateString()
                    : "Unknown"}
                </td>
                <td>
                  <div className="row-actions">
                    <details className="menu">
                      <summary aria-label={`Actions for ${paper.title}`}>•••</summary>
                      <div className="menu-popover">
                        <Link className="menu-link" href={itemHref as never}>
                          <span>Inspect</span>
                        </Link>
                        <Link
                          className="menu-link"
                          href={`/library/${libraryId}/paper/${paper.driveFileId}`}
                        >
                          <span>Open preview</span>
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
                            <span>Edit below</span>
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
