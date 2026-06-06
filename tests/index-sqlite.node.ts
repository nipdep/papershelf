import assert from "node:assert/strict";

import { createIndexSqlite, parseIndexSqlite, searchIndexSqlite } from "@/lib/server/index-sqlite";

async function main() {
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
        accessLevel: "anyone_with_link",
        indexedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  const parsed = await parseIndexSqlite(bytes);
  const results = await searchIndexSqlite(bytes, "attention");

  assert.equal(parsed.folders.length, 1);
  assert.equal(parsed.papers[0]?.title, "Attention Is All You Need");
  assert.equal(parsed.papers[0]?.accessLevel, "anyone_with_link");
  assert.equal(results[0]?.driveFileId, "paper-1");
  console.log("index-sqlite node test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
