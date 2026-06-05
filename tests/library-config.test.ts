import { describe, expect, it } from "vitest";

import {
  createEmptyLibraryConfig,
  removeLibraryRecord,
  upsertLibraryRecord
} from "@/lib/server/library-config";

describe("library config", () => {
  it("adds libraries", () => {
    const config = upsertLibraryRecord(createEmptyLibraryConfig(), {
      id: "lib-1",
      driveFolderId: "folder-1",
      displayName: "Main Library"
    });

    expect(config.libraries).toHaveLength(1);
    expect(config.libraries[0]?.displayName).toBe("Main Library");
  });

  it("deduplicates libraries by drive folder id", () => {
    const once = upsertLibraryRecord(createEmptyLibraryConfig(), {
      id: "lib-1",
      driveFolderId: "folder-1",
      displayName: "First"
    });
    const twice = upsertLibraryRecord(once, {
      id: "lib-2",
      driveFolderId: "folder-1",
      displayName: "Updated"
    });

    expect(twice.libraries).toHaveLength(1);
    expect(twice.libraries[0]?.displayName).toBe("Updated");
  });

  it("preserves cached stats when updating a library", () => {
    const once = upsertLibraryRecord(createEmptyLibraryConfig(), {
      id: "lib-1",
      driveFolderId: "folder-1",
      displayName: "First",
      cachedPaperCount: 12,
      cachedFolderCount: 4,
      cachedGeneratedAt: "2026-06-05T00:00:00.000Z"
    });
    const twice = upsertLibraryRecord(once, {
      id: "lib-1",
      driveFolderId: "folder-1",
      displayName: "Updated"
    });

    expect(twice.libraries[0]?.cachedPaperCount).toBe(12);
    expect(twice.libraries[0]?.cachedFolderCount).toBe(4);
    expect(twice.libraries[0]?.cachedGeneratedAt).toBe("2026-06-05T00:00:00.000Z");
  });

  it("removes libraries by id", () => {
    const config = upsertLibraryRecord(createEmptyLibraryConfig(), {
      id: "lib-1",
      driveFolderId: "folder-1"
    });

    expect(removeLibraryRecord(config, "lib-1").libraries).toHaveLength(0);
  });
});
