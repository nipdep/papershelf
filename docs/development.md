# Development Guide

## Purpose

This app implements the `build_documentation/` specification as a small, Drive-first web application.

## Architecture

```text
Browser
  -> Next.js pages and API routes
  -> Auth.js session with Google access token
  -> Google Drive API
  -> library root folder
      -> PDFs and subfolders
      -> .paper-manager/index.sqlite

Owner config
  -> Google Drive appDataFolder
  -> papershelf-config.json
```

## Key Design Decisions

- No external database.
- Google Drive remains the permission system.
- `index.sqlite` is a rebuildable cache.
- UI stays intentionally minimal and mostly server-rendered.
- Admin configuration is persisted in Drive app data instead of local disk.

## Important Directories

- [app](/Users/nipunpathitage/Dev/papershelf/app): routes, pages, API handlers
- [components](/Users/nipunpathitage/Dev/papershelf/components): minimal UI pieces
- [lib/google](/Users/nipunpathitage/Dev/papershelf/lib/google): Drive client wrapper
- [lib/server](/Users/nipunpathitage/Dev/papershelf/lib/server): config, authz, indexing, library services
- [tests](/Users/nipunpathitage/Dev/papershelf/tests): unit tests for core features
- [build_documentation](/Users/nipunpathitage/Dev/papershelf/build_documentation): original build specification

## Environment Variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `SYSTEM_OWNER_EMAIL`
- `DEFAULT_LIBRARY_FOLDER_IDS` optional comma-separated bootstrap list

## Google OAuth Setup

1. Create a Google Cloud OAuth web application.
2. Add local redirect URI:
   `http://localhost:3000/api/auth/callback/google`
3. Add deployed redirect URI:
   `https://<your-domain>/api/auth/callback/google`
4. Enable Drive API.

## Drive Scope Model

Current implementation uses:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/drive.appdata`

This allows:

- browsing and reading
- edit operations when Drive permissions allow
- persisting owner configuration in app data

## Testing

Run:

```bash
npm run test
```

Covered areas:

- folder URL parsing and title derivation
- session/owner permission helpers
- library config mutation rules
- recursive Drive scanning behavior
- SQLite index generation, parsing, and search
- core folder tree and paper table rendering

## Build

Run:

```bash
npm run build
```

The scripts explicitly set a wasm SWC path for this workspace so builds remain portable in environments where native SWC binaries cannot load.

## Operational Behavior

- Add/remove library roots through `/admin`.
- Rebuild writes `.paper-manager/index.sqlite` into the library root.
- Upload/move/rename/trash operations update Drive first and then trigger a rebuild.
- Permission checks are enforced server-side even if UI actions are hidden.

## Known MVP Constraints

- The library page uses simple forms for rename/move/trash by Drive file ID to keep the UI very small.
- Search is instant on loaded index data in the page, while the API also exposes server-side index search.
- No Google Picker integration yet; owner adds a folder by pasted URL or ID.
