"use client";

import { useEffect } from "react";

export function AutoIndexTrigger({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    void fetch("/api/indexing/rebuild-all", {
      method: "POST",
      credentials: "same-origin"
    }).catch(() => {
      // Keep the UI usable even if background indexing fails.
    });
  }, [enabled]);

  return null;
}
