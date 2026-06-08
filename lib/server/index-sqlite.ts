import path from "node:path";
import initSqlJs from "sql.js";
import type { Database, QueryExecResult, SqlJsStatic } from "sql.js";

import { AppError } from "@/lib/errors";
import { IndexedFolder, IndexedPaper, LibraryIndexData, SearchResult } from "@/lib/models";

type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;

let sqlJsPromise: Promise<SqlJsStatic> | undefined;
const sqlWasmPath = path.join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      // Use an explicit filesystem path so the Node build can open the wasm directly.
      locateFile(file) {
        return file === "sql-wasm.wasm" ? sqlWasmPath : file;
      }
    });
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

function hasColumn(db: Database, tableName: string, columnName: string): boolean {
  const rows = queryRows(db, `PRAGMA table_info(${tableName});`);
  return rows.some((row) => String(row.name) === columnName);
}

function parseSharedUsers(value: SqlValue) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Array<{ id?: string; emailAddress?: string }>;
    return parsed
      .filter((entry): entry is { id: string; emailAddress?: string } => typeof entry.id === "string")
      .map((entry) => ({
        id: entry.id,
        emailAddress: entry.emailAddress
      }));
  } catch {
    return undefined;
  }
}

export async function createIndexSqlite(input: {
  folders: IndexedFolder[];
  papers: IndexedPaper[];
  metadata?: Pick<
    LibraryIndexData,
    "generatedAt" | "sourceLibraryId" | "sourceLibraryName" | "indexKind" | "userId"
  >;
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
        created_time TEXT,
        access_level TEXT NOT NULL DEFAULT 'restricted',
        shared_users_json TEXT
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
        access_level TEXT NOT NULL DEFAULT 'restricted',
        indexed_at TEXT NOT NULL,
        shared_users_json TEXT,
        FOREIGN KEY (drive_folder_id) REFERENCES folders(drive_folder_id)
      );

      CREATE INDEX IF NOT EXISTS idx_papers_folder ON papers(drive_folder_id);
      CREATE INDEX IF NOT EXISTS idx_papers_title ON papers(title);
      CREATE INDEX IF NOT EXISTS idx_papers_path ON papers(path);
    `);

    db.run(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES
        ('schema_version', '3'),
        ('generated_at', ?),
        ('app_name', 'drive-paper-library');`,
      [input.metadata?.generatedAt ?? new Date().toISOString()]
    );

    if (input.metadata?.sourceLibraryId) {
      db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('source_library_id', ?);", [
        input.metadata.sourceLibraryId
      ]);
    }
    if (input.metadata?.sourceLibraryName) {
      db.run(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('source_library_name', ?);",
        [input.metadata.sourceLibraryName]
      );
    }
    if (input.metadata?.indexKind) {
      db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('index_kind', ?);", [
        input.metadata.indexKind
      ]);
    }
    if (input.metadata?.userId) {
      db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('user_id', ?);", [
        input.metadata.userId
      ]);
    }

    for (const folder of input.folders) {
      db.run(
        `INSERT INTO folders (
          drive_folder_id, parent_folder_id, name, path, depth, modified_time, created_time,
          access_level, shared_users_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          folder.driveFolderId,
          folder.parentFolderId,
          folder.name,
          folder.path,
          folder.depth,
          folder.modifiedTime ?? null,
          folder.createdTime ?? null,
          folder.accessLevel ?? "restricted",
          folder.sharedUsers?.length ? JSON.stringify(folder.sharedUsers) : null
        ]
      );
    }

    for (const paper of input.papers) {
      db.run(
        `INSERT INTO papers (
          drive_file_id, drive_folder_id, title, file_name, path, mime_type,
          modified_time, created_time, size_bytes, web_view_link, access_level, indexed_at,
          shared_users_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          paper.accessLevel,
          paper.indexedAt,
          paper.sharedUsers?.length ? JSON.stringify(paper.sharedUsers) : null
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
      const hasAccessLevel = hasColumn(db, "papers", "access_level");
      const hasFolderAccessLevel = hasColumn(db, "folders", "access_level");
      const hasFolderSharedUsers = hasColumn(db, "folders", "shared_users_json");
      const hasPaperSharedUsers = hasColumn(db, "papers", "shared_users_json");
      const folderRows = queryRows(
        db,
        `
        SELECT drive_folder_id, parent_folder_id, name, path, depth, modified_time, created_time,
               ${hasFolderAccessLevel ? "access_level" : "'restricted' AS access_level"},
               ${hasFolderSharedUsers ? "shared_users_json" : "NULL AS shared_users_json"}
        FROM folders
        ORDER BY depth, path
      `
      );

      const paperRows = queryRows(
        db,
        `
        SELECT drive_file_id, drive_folder_id, title, file_name, path, mime_type,
               modified_time, created_time, size_bytes, web_view_link,
               ${hasAccessLevel ? "access_level" : "'restricted' AS access_level"},
               indexed_at,
               ${hasPaperSharedUsers ? "shared_users_json" : "NULL AS shared_users_json"}
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
        createdTime: row.created_time ? String(row.created_time) : undefined,
        accessLevel:
          row.access_level === "anyone_with_link" || row.access_level === "public_on_web"
            ? row.access_level
            : "restricted",
        sharedUsers: parseSharedUsers(row.shared_users_json)
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
        accessLevel:
          row.access_level === "anyone_with_link" || row.access_level === "public_on_web"
            ? row.access_level
            : "restricted",
        indexedAt: String(row.indexed_at),
        sharedUsers: parseSharedUsers(row.shared_users_json)
      }));

      return {
        generatedAt: getSingleStringValue(db, "generated_at"),
        sourceLibraryId: getSingleStringValue(db, "source_library_id"),
        sourceLibraryName: getSingleStringValue(db, "source_library_name"),
        indexKind:
          getSingleStringValue(db, "index_kind") === "master" ||
          getSingleStringValue(db, "index_kind") === "anyone" ||
          getSingleStringValue(db, "index_kind") === "user"
            ? (getSingleStringValue(db, "index_kind") as LibraryIndexData["indexKind"])
            : undefined,
        userId: getSingleStringValue(db, "user_id"),
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
    const hasAccessLevel = hasColumn(db, "papers", "access_level");

    const rows = isFtsEnabled
      ? queryRows(
          db,
          `
          SELECT p.drive_file_id, p.drive_folder_id, p.title, p.file_name, p.path, p.mime_type,
                 p.modified_time, p.created_time, p.size_bytes, p.web_view_link,
                 ${hasAccessLevel ? "p.access_level" : "'restricted'"} AS access_level,
                 p.indexed_at
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
                 modified_time, created_time, size_bytes, web_view_link,
                 ${hasAccessLevel ? "access_level" : "'restricted'"} AS access_level,
                 indexed_at
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
      accessLevel:
        row.access_level === "anyone_with_link" || row.access_level === "public_on_web"
          ? row.access_level
          : "restricted",
      indexedAt: String(row.indexed_at)
    }));
  }, bytes);
}
