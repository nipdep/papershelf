import Link from "next/link";

export function AppNav({
  isOwner,
  current = "home"
}: {
  isOwner: boolean;
  current?: "home" | "admin" | "library";
}) {
  return (
    <aside className="nav-panel">
      <section className="nav-section">
        <div className="nav-heading">Workspace</div>
        <Link className={`nav-item ${current === "home" ? "active" : ""}`} href="/">
          <strong>Libraries</strong>
          <span>Shared research collections in Drive</span>
        </Link>
        {isOwner ? (
          <Link className={`nav-item ${current === "admin" ? "active" : ""}`} href="/admin">
            <strong>Settings</strong>
            <span>Drive roots, sync, and instance controls</span>
          </Link>
        ) : null}
      </section>

      <section className="nav-section">
        <div className="nav-heading">Interaction model</div>
        <div className={`nav-item ${current === "library" ? "active" : ""}`}>
          <strong>Finder-style browse</strong>
          <span>Use the left tree, center list, and right inspector together</span>
        </div>
      </section>
    </aside>
  );
}
