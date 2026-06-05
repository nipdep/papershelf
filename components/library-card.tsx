import Link from "next/link";

import { LibrarySummary } from "@/lib/models";

export function LibraryCard({ library }: { library: LibrarySummary }) {
  return (
    <article className="card">
      <div className="stack-sm">
        <p className="eyebrow">{library.accessible ? "Accessible" : "Unavailable"}</p>
        <h2>{library.name}</h2>
        <p className="muted">
          {library.canEdit ? "Edit enabled through Drive" : "Read-only through Drive"}
        </p>
        <p className="muted">
          Index: {library.indexStatus}
          {library.generatedAt ? ` · ${new Date(library.generatedAt).toLocaleString()}` : ""}
        </p>
      </div>
      <div className="row">
        {library.accessible ? (
          <Link className="button" href={`/library/${library.driveFolderId}`}>
            Open library
          </Link>
        ) : (
          <span className="muted">Share the Drive folder to access it.</span>
        )}
      </div>
    </article>
  );
}
