# Codex Build Plan

Use this file as the step-by-step implementation prompt sequence for Codex.

## Build Philosophy

Build the app in thin vertical slices. Each milestone should produce a runnable app.

Do not build advanced metadata extraction, citations, AI, annotations, or real-time sync in the first pass.

## Milestone 1 — Project Skeleton

Goal: Create a deployable Next.js app.

Tasks:

```text
1. Create Next.js App Router project with TypeScript.
2. Add Tailwind CSS.
3. Add basic layout with top nav.
4. Add home page with sign-in placeholder.
5. Add `/admin` and `/library/[libraryId]` placeholder pages.
6. Add environment variable validation helper.
```

Acceptance:

```text
npm run dev works
npm run build works
Home/admin/library placeholder pages render
```

## Milestone 2 — Google Authentication

Goal: Users can login with Google and app detects owner.

Tasks:

```text
1. Add Auth.js/NextAuth Google provider.
2. Configure env vars.
3. Add `/api/me` route.
4. Add sign in/sign out buttons.
5. Display user email and owner badge.
6. Protect `/admin` so only SYSTEM_OWNER_EMAIL can access.
```

Acceptance:

```text
Google login works locally
/api/me returns email and isOwner
Non-owner cannot access admin page
```

## Milestone 3 — Drive Client Utilities

Goal: Server can call Google Drive API for current user.

Tasks:

```text
1. Create `lib/google/drive.ts`.
2. Implement getDriveClientForSession().
3. Implement getFileMetadata(fileId).
4. Implement listFolderChildren(folderId).
5. Implement ensurePaperManagerFolder(libraryRootId).
6. Implement uploadOrUpdateIndexSqlite().
```

Acceptance:

```text
Given a folder ID, server can list child files/folders
Server can detect PDF files and folders
```

## Milestone 4 — Library Configuration

Goal: Owner can add a Drive folder as a library.

Implementation choice for MVP:

```text
Use `.paper-manager/config.json` inside each library folder if needed,
or use env var DEFAULT_LIBRARY_FOLDER_IDS for first version.
```

Recommended first version:

```text
DEFAULT_LIBRARY_FOLDER_IDS=folderId1,folderId2
```

Then add owner-managed config later.

Tasks:

```text
1. Implement `/api/libraries`.
2. Read library IDs from env var initially.
3. For each library, fetch Drive metadata.
4. Return accessible/canEdit/canAddChildren status.
5. Render library cards on home page.
```

Acceptance:

```text
Home page shows accessible Drive libraries
Inaccessible folders are handled cleanly
```

## Milestone 5 — SQLite Schema Builder

Goal: Generate a valid SQLite index from in-memory folder/paper data.

Tasks:

```text
1. Add SQLite library suitable for server runtime.
2. Implement schema from `03_DATA_MODEL_SQLITE.md`.
3. Implement createIndexSqlite({folders, papers}).
4. Add unit tests for titleFromFileName and path creation.
```

Acceptance:

```text
Function creates SQLite file with folders, papers, and app_meta
Can query generated DB locally
```

## Milestone 6 — Recursive Drive Scanner

Goal: Recursively scan library root folder.

Tasks:

```text
1. Implement scanDriveLibrary(rootFolderId).
2. Traverse arbitrary-depth folder tree.
3. Skip `.paper-manager`.
4. Collect only PDFs and folders.
5. Generate normalized paths.
6. Handle pagination.
```

Acceptance:

```text
Scanner returns folders[] and papers[] for nested Drive folder
No fixed depth assumptions
```

## Milestone 7 — Rebuild Index API

Goal: Owner/editor can rebuild `index.sqlite` and upload it to Drive.

Tasks:

```text
1. Implement POST `/api/libraries/:libraryId/rebuild-index`.
2. Check user access and capability.
3. Run scanner.
4. Build SQLite file in /tmp.
5. Upload to `.paper-manager/index.sqlite`.
6. Return summary counts.
```

Acceptance:

```text
Clicking Rebuild Index creates/updates Drive index file
Returned counts match Drive folder contents
```

## Milestone 8 — Read Index API

Goal: App reads SQLite index and returns JSON for UI.

Tasks:

```text
1. Implement downloadIndexSqlite(libraryId).
2. Implement parseIndexSqlite().
3. Implement GET `/api/libraries/:libraryId/index`.
4. Implement GET `/api/libraries/:libraryId/search?q=`.
```

Acceptance:

```text
Library page can load folder tree and papers from index.sqlite
Search returns matching paper rows
```

## Milestone 9 — Library UI

Goal: Browse/search/open papers.

Tasks:

```text
1. Build FolderTree component.
2. Build PaperTable component.
3. Build SearchBox component.
4. Implement folder filtering.
5. Implement Open button using Drive preview URL.
6. Show index generated timestamp.
```

Acceptance:

```text
User can browse arbitrary-depth folders
User can search title/file/path
User can open PDFs
```

## Milestone 10 — Edit Operations

Goal: Users with Drive edit permission can manage papers/folders.

Tasks:

```text
1. Add create subfolder API.
2. Add upload PDF API.
3. Add rename paper API.
4. Add move paper API.
5. Add trash paper API with confirmation.
6. Hide controls unless Drive capabilities allow.
7. Mark index stale or rebuild after operation.
```

Acceptance:

```text
Drive editor can upload/move/rename/trash
Drive viewer cannot see or call edit operations successfully
```

## Milestone 11 — Owner Admin UI

Goal: Owner has operational control.

Tasks:

```text
1. Admin page lists libraries.
2. Add library by pasted Drive folder URL/ID.
3. Remove library from app config.
4. Trigger rebuild.
5. Open Drive sharing page.
6. Show diagnostics.
```

Acceptance:

```text
Owner can manage library roots without code changes
```

## Milestone 12 — Polish and Deployment

Goal: Ready for fork-and-deploy usage.

Tasks:

```text
1. Add README setup guide.
2. Add env example.
3. Add Google Cloud OAuth setup instructions.
4. Add Vercel deployment instructions.
5. Add error pages and empty states.
6. Add basic tests.
7. Run build/lint.
```

Acceptance:

```text
A new user can fork, configure, deploy, login, add Drive folder, index it, and browse papers
```
