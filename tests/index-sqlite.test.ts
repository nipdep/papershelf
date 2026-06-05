import { describe, expect, it } from "vitest";

import { createIndexSqlite, parseIndexSqlite, searchIndexSqlite } from "@/lib/server/index-sqlite";

describe("index sqlite", () => {
  it("round-trips folder and paper data", async () => {
    const bytes = await createIndexSqlite({
      folders: [
        {
          driveFolderId: "root",
          parentFolderId: null,
          name: "Root",
          path: "/",
          depth: 0
        }
      ],
      papers: [
        {
          driveFileId: "paper-1",
          driveFolderId: "root",
          title: "Attention Is All You Need",
          fileName: "Attention Is All You Need.pdf",
          path: "/Attention Is All You Need.pdf",
          mimeType: "application/pdf",
          indexedAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    });

    const parsed = await parseIndexSqlite(bytes);
    const results = await searchIndexSqlite(bytes, "attention");

    expect(parsed.folders).toHaveLength(1);
    expect(parsed.papers[0]?.title).toBe("Attention Is All You Need");
    expect(results[0]?.driveFileId).toBe("paper-1");
  });
});
