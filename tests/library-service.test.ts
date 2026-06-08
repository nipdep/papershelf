import { describe, expect, it } from "vitest";

import { mergeLibraryRecords } from "@/lib/server/library-service";

describe("library service", () => {
  it("keeps configured libraries and appends discovered shared libraries", () => {
    const merged = mergeLibraryRecords(
      [
        {
          id: "configured-lib",
          driveFolderId: "configured-lib",
          displayName: "Configured Library",
          addedAt: "2026-06-08T00:00:00.000Z"
        }
      ],
      ["configured-lib", "shared-lib"]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((library) => library.driveFolderId)).toEqual([
      "configured-lib",
      "shared-lib"
    ]);
    expect(merged[0]?.displayName).toBe("Configured Library");
    expect(merged[1]).toMatchObject({
      id: "shared-lib",
      driveFolderId: "shared-lib"
    });
  });
});
