import Link from "next/link";

import { LibrarySummary } from "@/lib/models";

export function LibraryCard({ library }: { library: LibrarySummary }) {
  return (
    <article className="card library-card glass-card">
      <div className="library-card-head">
        <div className="stack-sm">
          <p className="eyebrow">{library.accessible ? "Accessible" : "Unavailable"}</p>
          <h2>{library.name}</h2>
          <p className="muted">
            {library.canEdit ? "Edit enabled through Drive" : "Read-only through Drive"}
          </p>
        </div>
        <span className={`status-chip ${library.canEdit ? "editable" : ""}`}>
          {library.indexStatus}
        </span>
      </div>

      <div className="metric-row">
        <div className="metric-pill">Drive root</div>
        <div className="metric-pill">
          {library.generatedAt
            ? `Indexed ${new Date(library.generatedAt).toLocaleDateString()}`
            : "Index not built"}
        </div>
      </div>

      <div className="library-card-foot">
        {library.accessible ? (
          <Link className="inline-link" href={`/library/${library.driveFolderId}`}>
            Open workspace
          </Link>
        ) : (
          <span className="muted">Share the Drive folder to access it.</span>
        )}
        {library.webViewLink ? (
          <a href={library.webViewLink} rel="noreferrer" target="_blank">
            View in Drive
          </a>
        ) : null}
      </div>
    </article>
  );
}
