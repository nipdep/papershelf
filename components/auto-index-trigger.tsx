"use client";

import { useEffect } from "react";

export function AutoIndexTrigger({
  enabled,
  cacheKey
}: {
  enabled: boolean;
  cacheKey?: string;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const storageKey = `papershelf:auto-index:${cacheKey ?? "default"}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "done") {
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "done");
    }

    void fetch("/api/indexing/rebuild-all", {
      method: "POST",
      credentials: "same-origin"
    }).catch(() => {
      // Let future navigations retry if background indexing fails.
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(storageKey);
      }
    });
  }, [cacheKey, enabled]);

  return null;
}
