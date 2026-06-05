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

  it("removes libraries by id", () => {
    const config = upsertLibraryRecord(createEmptyLibraryConfig(), {
      id: "lib-1",
      driveFolderId: "folder-1"
    });

    expect(removeLibraryRecord(config, "lib-1").libraries).toHaveLength(0);
  });
});
