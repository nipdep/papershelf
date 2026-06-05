# Acceptance Checklist

Use this checklist before considering the app MVP complete.

## Authentication

- [ ] User can sign in with Google.
- [ ] User can sign out.
- [ ] `/api/me` returns authenticated email.
- [ ] Owner is detected via `SYSTEM_OWNER_EMAIL`.
- [ ] Non-owner cannot access Admin page.

## Drive Access

- [ ] App can fetch metadata for configured Drive folder.
- [ ] App handles inaccessible folders gracefully.
- [ ] App lists child folders and PDFs.
- [ ] App handles pagination.
- [ ] App skips trashed files.
- [ ] App skips `.paper-manager` during scan.

## Indexing

- [ ] Rebuild index scans arbitrary-depth folder tree.
- [ ] `index.sqlite` is created in `.paper-manager`.
- [ ] `folders` table contains correct parent relationships.
- [ ] `papers` table contains correct file IDs and paths.
- [ ] Title is derived from filename.
- [ ] FTS search works or fallback LIKE search works.
- [ ] Corrupt/missing index shows recoverable error.

## UI

- [ ] Home page shows accessible libraries.
- [ ] Library page shows folder tree.
- [ ] Folder tree supports arbitrary depth.
- [ ] Paper table shows title, filename, path.
- [ ] Search works over title, filename, path.
- [ ] Open PDF button opens Drive preview/web view.
- [ ] Empty states are clear.

## Permissions

- [ ] App does not store permissions in SQLite.
- [ ] View access is based on Google Drive access.
- [ ] Edit buttons are hidden for read-only users.
- [ ] Edit API routes re-check Drive capabilities server-side.
- [ ] Owner-only API routes check `SYSTEM_OWNER_EMAIL` server-side.

## Edit Operations

- [ ] Drive editor can create subfolder.
- [ ] Drive editor can upload PDF.
- [ ] Drive editor can rename paper.
- [ ] Drive editor can move paper.
- [ ] Drive editor can trash paper only with confirmation.
- [ ] Viewer cannot perform edit operations via direct API calls.

## Security

- [ ] No OAuth tokens are stored in `index.sqlite`.
- [ ] No API keys are stored in `index.sqlite`.
- [ ] No app secrets are sent to browser.
- [ ] Server validates all input.
- [ ] Destructive operations require confirmation.

## Deployment

- [ ] `npm run build` passes.
- [ ] Required env vars documented.
- [ ] Local OAuth redirect works.
- [ ] Vercel OAuth redirect works.
- [ ] Fresh fork can deploy with only documented setup.

## Product Boundary

- [ ] App does not try to replace Drive sharing UI.
- [ ] App does not duplicate Drive permissions.
- [ ] App treats SQLite index as rebuildable cache.
- [ ] PDFs remain only in Google Drive.
