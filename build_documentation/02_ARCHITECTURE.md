# Architecture

## High-level Architecture

```text
Browser UI
  ↓
Next.js App Router / API Routes on Vercel
  ↓
Google OAuth session
  ↓
Google Drive API
  ↓
Drive library root folder
  ├── PDFs and subfolders
  └── .paper-manager/index.sqlite
```

## Core Components

### 1. Next.js App

Responsibilities:

- Render UI.
- Handle Google login.
- Maintain user session.
- Call internal API routes.
- Display library tree, paper table, search, PDF view links.

Suggested stack:

```text
Next.js App Router
TypeScript
Tailwind CSS
Auth.js / NextAuth or custom Google OAuth
better-sqlite3 or sql.js for local SQLite processing
Google APIs Node client or direct REST calls
```

### 2. Google Drive

Responsibilities:

- Store all PDFs.
- Store actual folder hierarchy.
- Manage sharing and permissions.
- Store `.paper-manager/index.sqlite` cache file.

### 3. SQLite Index File

Each library root folder gets its own SQLite index.

```text
Research Papers/
├── subfolders...
├── papers...
└── .paper-manager/
    ├── index.sqlite
    └── config.json optional
```

The index is rebuildable. It is not the source of truth.

### 4. No External Database in MVP

The app should not require Postgres, Supabase, Firebase, Redis, etc.

Optional later additions:

- Turso/libSQL for hosted SQLite
- external search service
- object storage for thumbnails

## Source of Truth Rules

| Data | Source of truth |
|---|---|
| PDF existence | Google Drive |
| Folder hierarchy | Google Drive |
| User access | Google Drive permissions |
| Owner identity | env var `SYSTEM_OWNER_EMAIL` |
| Paper title in MVP | SQLite cache from file name or manual metadata |
| Search index | SQLite, rebuildable |

## Request Flow: View Library

```text
1. User opens app.
2. User authenticates with Google.
3. App checks configured library roots.
4. For each library, app checks whether user can access the root folder.
5. App downloads or streams `.paper-manager/index.sqlite`.
6. App filters/validates results as needed.
7. UI renders searchable tree/list.
```

## Request Flow: Open Paper

```text
1. User clicks paper.
2. App has `drive_file_id` from index.
3. App checks Drive access or relies on Drive preview access.
4. App opens Drive preview/webViewLink.
```

## Request Flow: Rebuild Index

```text
1. Owner or user with Drive edit permission clicks Rebuild Index.
2. App recursively scans Drive folder tree from library root.
3. App collects folders and PDF files.
4. App creates SQLite database in temporary local filesystem or memory.
5. App uploads/replaces `.paper-manager/index.sqlite`.
```

## Important Vercel Constraint

Vercel serverless functions do not provide durable local disk. Any local SQLite file created during an API request must be treated as temporary.

This is acceptable because:

```text
temporary SQLite file → uploaded to Drive → local copy discarded
```

Do not expect local files to persist between function invocations.
