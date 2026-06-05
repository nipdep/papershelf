import path from "node:path";

import initSqlJs from "sql.js";

import { AppError } from "@/lib/errors";
import { IndexedFolder, IndexedPaper, LibraryIndexData, SearchResult } from "@/lib/models";

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
    });
  }

  return sqlPromise;
}

function getSingleStringValue(db: any, key: string): string | undefined {
  const result = db.exec("SELECT value FROM app_meta WHERE key = ?;", [key]);
  return result[0]?.values?.[0]?.[0] as string | undefined;
}

export async function createIndexSqlite(input: {
  folders: IndexedFolder[];
  papers: IndexedPaper[];
}) {
  const SQL = await getSql();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      drive_folder_id TEXT PRIMARY KEY,
      parent_folder_id TEXT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      depth INTEGER NOT NULL,
      modified_time TEXT,
      created_time TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
    CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);

    CREATE TABLE IF NOT EXISTS papers (
      drive_file_id TEXT PRIMARY KEY,
      drive_folder_id TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      path TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      modified_time TEXT,
      created_time TEXT,
      size_bytes INTEGER,
      web_view_link TEXT,
      indexed_at TEXT NOT NULL,
      FOREIGN KEY (drive_folder_id) REFERENCES folders(drive_folder_id)
    );

    CREATE INDEX IF NOT EXISTS idx_papers_folder ON papers(drive_folder_id);
    CREATE INDEX IF NOT EXISTS idx_papers_title ON papers(title);
    CREATE INDEX IF NOT EXISTS idx_papers_path ON papers(path);
  `);

  db.run(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES
      ('schema_version', '1'),
      ('generated_at', ?),
      ('app_name', 'drive-paper-library');`,
    [new Date().toISOString()]
  );

  const folderStatement = db.prepare(`
    INSERT INTO folders (
      drive_folder_id, parent_folder_id, name, path, depth, modified_time, created_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const folder of input.folders) {
    folderStatement.run([
      folder.driveFolderId,
      folder.parentFolderId,
      folder.name,
      folder.path,
      folder.depth,
      folder.modifiedTime ?? null,
      folder.createdTime ?? null
    ]);
  }
  folderStatement.free();

  const paperStatement = db.prepare(`
    INSERT INTO papers (
      drive_file_id, drive_folder_id, title, file_name, path, mime_type,
      modified_time, created_time, size_bytes, web_view_link, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const paper of input.papers) {
    paperStatement.run([
      paper.driveFileId,
      paper.driveFolderId,
      paper.title,
      paper.fileName,
      paper.path,
      paper.mimeType,
      paper.modifiedTime ?? null,
      paper.createdTime ?? null,
      paper.sizeBytes ?? null,
      paper.webViewLink ?? null,
      paper.indexedAt
    ]);
  }
  paperStatement.free();

  let hasFts = true;
  try {
    db.run(`
      CREATE VIRTUAL TABLE papers_fts USING fts5(
        drive_file_id UNINDEXED,
        title,
        file_name,
        path
      );
    `);
    db.run(`
      INSERT INTO papers_fts (drive_file_id, title, file_name, path)
      SELECT drive_file_id, title, file_name, path FROM papers;
    `);
  } catch {
    hasFts = false;
  }

  db.run(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('fts_enabled', ?);",
    [hasFts ? "1" : "0"]
  );

  const bytes = db.export();
  db.close();
  return bytes;
}

export async function parseIndexSqlite(bytes: Uint8Array): Promise<LibraryIndexData> {
  const SQL = await getSql();
  const db = new SQL.Database(bytes);

  try {
    const foldersResult = db.exec(`
      SELECT drive_folder_id, parent_folder_id, name, path, depth, modified_time, created_time
      FROM folders
      ORDER BY depth, path
    `);
    const papersResult = db.exec(`
      SELECT drive_file_id, drive_folder_id, title, file_name, path, mime_type,
             modified_time, created_time, size_bytes, web_view_link, indexed_at
      FROM papers
      ORDER BY title
    `);

    const folders: IndexedFolder[] = (foldersResult[0]?.values ?? []).map((row) => ({
      driveFolderId: String(row[0]),
      parentFolderId: row[1] ? String(row[1]) : null,
      name: String(row[2]),
      path: String(row[3]),
      depth: Number(row[4]),
      modifiedTime: row[5] ? String(row[5]) : undefined,
      createdTime: row[6] ? String(row[6]) : undefined
    }));

    const papers: IndexedPaper[] = (papersResult[0]?.values ?? []).map((row) => ({
      driveFileId: String(row[0]),
      driveFolderId: String(row[1]),
      title: String(row[2]),
      fileName: String(row[3]),
      path: String(row[4]),
      mimeType: String(row[5]),
      modifiedTime: row[6] ? String(row[6]) : undefined,
      createdTime: row[7] ? String(row[7]) : undefined,
      sizeBytes: row[8] ? Number(row[8]) : undefined,
      webViewLink: row[9] ? String(row[9]) : undefined,
      indexedAt: String(row[10])
    }));

    return {
      generatedAt: getSingleStringValue(db, "generated_at"),
      folders,
      papers
    };
  } catch {
    throw new AppError("INDEX_NOT_FOUND", "The index file could not be read.", 500);
  } finally {
    db.close();
  }
}

export async function searchIndexSqlite(
  bytes: Uint8Array,
  query: string
): Promise<SearchResult[]> {
  const SQL = await getSql();
  const db = new SQL.Database(bytes);
  const trimmed = query.trim();
  if (!trimmed) {
    db.close();
    return [];
  }

  try {
    const isFtsEnabled = getSingleStringValue(db, "fts_enabled") === "1";
    let results;

    if (isFtsEnabled) {
      results = db.exec(
        `
        SELECT p.drive_file_id, p.drive_folder_id, p.title, p.file_name, p.path, p.mime_type,
               p.modified_time, p.created_time, p.size_bytes, p.web_view_link, p.indexed_at
        FROM papers_fts f
        JOIN papers p ON p.drive_file_id = f.drive_file_id
        WHERE papers_fts MATCH ?
        ORDER BY bm25(papers_fts)
      `,
        [trimmed.replace(/\s+/g, " OR ")]
      );
    } else {
      const likeValue = `%${trimmed.toLowerCase()}%`;
      results = db.exec(
        `
        SELECT drive_file_id, drive_folder_id, title, file_name, path, mime_type,
               modified_time, created_time, size_bytes, web_view_link, indexed_at
        FROM papers
        WHERE lower(title) LIKE ?
           OR lower(file_name) LIKE ?
           OR lower(path) LIKE ?
        ORDER BY title
      `,
        [likeValue, likeValue, likeValue]
      );
    }

    return (results[0]?.values ?? []).map((row) => ({
      driveFileId: String(row[0]),
      driveFolderId: String(row[1]),
      title: String(row[2]),
      fileName: String(row[3]),
      path: String(row[4]),
      mimeType: String(row[5]),
      modifiedTime: row[6] ? String(row[6]) : undefined,
      createdTime: row[7] ? String(row[7]) : undefined,
      sizeBytes: row[8] ? Number(row[8]) : undefined,
      webViewLink: row[9] ? String(row[9]) : undefined,
      indexedAt: String(row[10])
    }));
  } finally {
    db.close();
  }
}
