import initSqlJs from "sql.js";
import type { Database, QueryExecResult, SqlJsStatic } from "sql.js";

import { AppError } from "@/lib/errors";
import { IndexedFolder, IndexedPaper, LibraryIndexData, SearchResult } from "@/lib/models";

type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;

let sqlJsPromise: Promise<SqlJsStatic> | undefined;

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }

  return sqlJsPromise;
}

async function withDb<T>(
  callback: (db: Database) => Promise<T> | T,
  bytes?: Uint8Array
): Promise<T> {
  const SQL = await getSqlJs();
  const db = new SQL.Database(bytes);

  try {
    return await callback(db);
  } finally {
    db.close();
  }
}

function queryRows(
  db: Database,
  sql: string,
  params?: SqlValue[]
): SqlRow[] {
  const [result] = db.exec(sql, params);
  if (!result) {
    return [];
  }

  return result.values.map((values: QueryExecResult["values"][number]) =>
    Object.fromEntries(result.columns.map((column: string, index: number) => [column, values[index] ?? null]))
  ) as SqlRow[];
}

function getSingleStringValue(
  db: Database,
  key: string
): string | undefined {
  const row = queryRows(db, "SELECT value FROM app_meta WHERE key = ?;", [key])[0];
  return typeof row?.value === "string" ? row.value : undefined;
}

export async function createIndexSqlite(input: {
  folders: IndexedFolder[];
  papers: IndexedPaper[];
}) {
  return withDb((db) => {
    db.exec(`
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

    for (const folder of input.folders) {
      db.run(
        `INSERT INTO folders (
          drive_folder_id, parent_folder_id, name, path, depth, modified_time, created_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          folder.driveFolderId,
          folder.parentFolderId,
          folder.name,
          folder.path,
          folder.depth,
          folder.modifiedTime ?? null,
          folder.createdTime ?? null
        ]
      );
    }

    for (const paper of input.papers) {
      db.run(
        `INSERT INTO papers (
          drive_file_id, drive_folder_id, title, file_name, path, mime_type,
          modified_time, created_time, size_bytes, web_view_link, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
      );
    }

    let hasFts = true;
    try {
      db.exec(`
        CREATE VIRTUAL TABLE papers_fts USING fts5(
          drive_file_id UNINDEXED,
          title,
          file_name,
          path
        );
      `);
      db.exec(`
        INSERT INTO papers_fts (drive_file_id, title, file_name, path)
        SELECT drive_file_id, title, file_name, path FROM papers;
      `);
    } catch {
      hasFts = false;
    }

    db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('fts_enabled', ?);", [
      hasFts ? "1" : "0"
    ]);

    return db.export();
  });
}

export async function parseIndexSqlite(bytes: Uint8Array): Promise<LibraryIndexData> {
  return withDb((db) => {
    try {
      const folderRows = queryRows(
        db,
        `
        SELECT drive_folder_id, parent_folder_id, name, path, depth, modified_time, created_time
        FROM folders
        ORDER BY depth, path
      `
      );

      const paperRows = queryRows(
        db,
        `
        SELECT drive_file_id, drive_folder_id, title, file_name, path, mime_type,
               modified_time, created_time, size_bytes, web_view_link, indexed_at
        FROM papers
        ORDER BY title
      `
      );

      const folders: IndexedFolder[] = folderRows.map((row) => ({
        driveFolderId: String(row.drive_folder_id),
        parentFolderId: row.parent_folder_id ? String(row.parent_folder_id) : null,
        name: String(row.name),
        path: String(row.path),
        depth: Number(row.depth),
        modifiedTime: row.modified_time ? String(row.modified_time) : undefined,
        createdTime: row.created_time ? String(row.created_time) : undefined
      }));

      const papers: IndexedPaper[] = paperRows.map((row) => ({
        driveFileId: String(row.drive_file_id),
        driveFolderId: String(row.drive_folder_id),
        title: String(row.title),
        fileName: String(row.file_name),
        path: String(row.path),
        mimeType: String(row.mime_type),
        modifiedTime: row.modified_time ? String(row.modified_time) : undefined,
        createdTime: row.created_time ? String(row.created_time) : undefined,
        sizeBytes: row.size_bytes ? Number(row.size_bytes) : undefined,
        webViewLink: row.web_view_link ? String(row.web_view_link) : undefined,
        indexedAt: String(row.indexed_at)
      }));

      return {
        generatedAt: getSingleStringValue(db, "generated_at"),
        folders,
        papers
      };
    } catch {
      throw new AppError("INDEX_NOT_FOUND", "The index file could not be read.", 500);
    }
  }, bytes);
}

export async function searchIndexSqlite(
  bytes: Uint8Array,
  query: string
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return withDb((db) => {
    const isFtsEnabled = getSingleStringValue(db, "fts_enabled") === "1";

    const rows = isFtsEnabled
      ? queryRows(
          db,
          `
          SELECT p.drive_file_id, p.drive_folder_id, p.title, p.file_name, p.path, p.mime_type,
                 p.modified_time, p.created_time, p.size_bytes, p.web_view_link, p.indexed_at
          FROM papers_fts f
          JOIN papers p ON p.drive_file_id = f.drive_file_id
          WHERE papers_fts MATCH ?
          ORDER BY bm25(papers_fts)
        `,
          [trimmed.replace(/\s+/g, " OR ")]
        )
      : queryRows(
          db,
          `
          SELECT drive_file_id, drive_folder_id, title, file_name, path, mime_type,
                 modified_time, created_time, size_bytes, web_view_link, indexed_at
          FROM papers
          WHERE lower(title) LIKE ?
             OR lower(file_name) LIKE ?
             OR lower(path) LIKE ?
          ORDER BY title
        `,
          [`%${trimmed.toLowerCase()}%`, `%${trimmed.toLowerCase()}%`, `%${trimmed.toLowerCase()}%`]
        );

    return rows.map((row) => ({
      driveFileId: String(row.drive_file_id),
      driveFolderId: String(row.drive_folder_id),
      title: String(row.title),
      fileName: String(row.file_name),
      path: String(row.path),
      mimeType: String(row.mime_type),
      modifiedTime: row.modified_time ? String(row.modified_time) : undefined,
      createdTime: row.created_time ? String(row.created_time) : undefined,
      sizeBytes: row.size_bytes ? Number(row.size_bytes) : undefined,
      webViewLink: row.web_view_link ? String(row.web_view_link) : undefined,
      indexedAt: String(row.indexed_at)
    }));
  }, bytes);
}
