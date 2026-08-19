export default function Loading() {
  return (
    <main className="workspace workspace-finder" aria-busy="true" aria-live="polite">
      <section className="finder-layout">
        <aside className="finder-sidebar">
          <div className="pane-header finder-sidebar-header">
            <div className="pane-title">
              <p className="eyebrow finder-sidebar-eyebrow">Library</p>
            </div>
          </div>
          <div className="empty-panel">
            <p className="muted">Loading folders…</p>
          </div>
        </aside>
        <section className="finder-main">
          <div className="finder-section-head">
            <div className="title-cluster">
              <p className="eyebrow">Collection</p>
              <h2>Loading your library…</h2>
            </div>
          </div>
          <section className="finder-list-shell">
            <div className="empty-panel">
              <p className="muted">Fetching the latest index from Google Drive.</p>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
