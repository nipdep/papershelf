import React from "react";
import Link from "next/link";

import { IndexedPaper } from "@/lib/models";

export function PaperTable({
  papers,
  canEdit,
  libraryId
}: {
  papers: IndexedPaper[];
  canEdit: boolean;
  libraryId: string;
}) {
  if (papers.length === 0) {
    return (
      <section className="card">
        <p className="muted">No papers match this view yet.</p>
      </section>
    );
  }

  return (
    <section className="card table-card">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>File name</th>
            <th>Path</th>
            <th>Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {papers.map((paper) => (
            <tr key={paper.driveFileId}>
              <td>{paper.title}</td>
              <td>{paper.fileName}</td>
              <td className="muted">{paper.path}</td>
              <td className="muted">
                {paper.modifiedTime
                  ? new Date(paper.modifiedTime).toLocaleDateString()
                  : "Unknown"}
              </td>
              <td>
                <div className="row wrap">
                  <Link
                    className="button button-inline"
                    href={`/library/${libraryId}/paper/${paper.driveFileId}`}
                  >
                    Open
                  </Link>
                  {paper.webViewLink ? (
                    <a
                      className="button button-inline button-secondary"
                      href={paper.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Drive
                    </a>
                  ) : null}
                  {canEdit ? <span className="muted">Edit below</span> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
