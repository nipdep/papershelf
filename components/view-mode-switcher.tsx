"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ViewModeSwitcher({
  value
}: {
  value: "list" | "split";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setMode = (nextMode: "list" | "split") => {
    document.cookie = `papershelf-layout=${nextMode}; path=/; max-age=31536000; samesite=lax`;
    const query = searchParams.toString();
    router.refresh();
    if (query) {
      router.replace(`/?${query}` as never);
      return;
    }
    router.replace("/" as never);
  };

  return (
    <details className="menu view-mode-switcher">
      <summary aria-label="Change view mode" className="shell-icon-button" title="View mode">
        {value === "split" ? (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 5h16v14H4V5Zm7 0v14" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 5h16v14H4V5Z" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </summary>
      <div className="menu-popover view-mode-popover">
        <button
          className={`menu-button ${value === "list" ? "is-selected" : ""}`}
          onClick={() => setMode("list")}
          type="button"
        >
          <span>No split</span>
        </button>
        <button
          className={`menu-button ${value === "split" ? "is-selected" : ""}`}
          onClick={() => setMode("split")}
          type="button"
        >
          <span>Vertical split</span>
        </button>
      </div>
    </details>
  );
}
