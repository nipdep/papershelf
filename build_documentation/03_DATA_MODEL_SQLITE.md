# SQLite Data Model

## Purpose

`index.sqlite` is a lightweight, rebuildable paper index for one Drive library root folder.

It should store only:

- Drive folder IDs
- Drive file IDs
- folder tree relationships
- paper titles or filenames
- queryable paths
- timestamps useful for staleness checks

It must not store:

- OAuth tokens
- API keys
- permission lists
- access-control state
- private secrets

## File Location

Inside each library root folder:

```text
.paper-manager/index.sqlite
```

## Schema Versioning

Use a metadata table.

```sql
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR REPLACE INTO app_meta (key, value) VALUES
  ('schema_version', '1'),
  ('generated_at', datetime('now')),
  ('app_name', 'drive-paper-library');
```

## Folder Table

Supports arbitrary folder depth using parent references.

```sql
CREATE TABLE folders (
  drive_folder_id TEXT PRIMARY KEY,
  parent_folder_id TEXT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  depth INTEGER NOT NULL,
  modified_time TEXT,
  created_time TEXT
);

CREATE INDEX idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX idx_folders_path ON folders(path);
```

Example:

```text
/ML/LLMs/RAG/2024
```

is represented by multiple folder rows linked by `parent_folder_id`.

## Papers Table

```sql
CREATE TABLE papers (
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

CREATE INDEX idx_papers_folder ON papers(drive_folder_id);
CREATE INDEX idx_papers_title ON papers(title);
CREATE INDEX idx_papers_path ON papers(path);
```

## FTS Search Table

Use SQLite FTS5 if available.

```sql
CREATE VIRTUAL TABLE papers_fts USING fts5(
  drive_file_id UNINDEXED,
  title,
  file_name,
  path
);
```

Populate after inserting papers:

```sql
INSERT INTO papers_fts (drive_file_id, title, file_name, path)
SELECT drive_file_id, title, file_name, path FROM papers;
```

Search query:

```sql
SELECT p.*
FROM papers_fts f
JOIN papers p ON p.drive_file_id = f.drive_file_id
WHERE papers_fts MATCH ?
ORDER BY bm25(papers_fts);
```

Fallback if FTS5 is unavailable:

```sql
SELECT *
FROM papers
WHERE lower(title) LIKE lower(?)
   OR lower(file_name) LIKE lower(?)
   OR lower(path) LIKE lower(?);
```

## Title Strategy for MVP

Initial title can simply be derived from filename:

```text
file_name = "Attention Is All You Need.pdf"
title = "Attention Is All You Need"
```

Rules:

- Strip `.pdf` extension.
- Replace underscores/hyphens with spaces only if useful.
- Preserve original filename separately.

## Rebuildability Rule

The full index can always be rebuilt from Drive by scanning folders and PDF files.

Therefore, never treat `index.sqlite` as authoritative for file existence or permission.
