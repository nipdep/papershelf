# Papershelf

Papershelf is a lightweight Google Drive-backed paper library built from the `build_documentation/` guide.

It keeps Google Drive as the source of truth for:

- PDFs
- folders and hierarchy
- sharing and permissions
- ownership and trash history

Papershelf adds:

- Google sign-in
- owner/admin setup
- library indexing into per-library `index.sqlite`
- minimal browse/search UI
- capability-aware edit actions

## Stack

- Next.js App Router
- TypeScript
- Auth.js with Google
- Google Drive API
- `sql.js` for portable SQLite generation and parsing
- Vitest for unit tests

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in Google OAuth and owner values.
   If you want anonymous read-only access for public libraries, also set `GOOGLE_API_KEY`
   and list those library root folder IDs in `DEFAULT_LIBRARY_FOLDER_IDS`.

4. Start the app:

```bash
npm run dev
```

5. Sign in as the configured owner and add a Drive folder in `/admin`.

## Scripts

```bash
npm run dev
npm run test
npm run build
```

## Documentation

- Developer docs: [docs/development.md](/Users/nipunpathitage/Dev/papershelf/docs/development.md)
- User docs: [docs/user-guide.md](/Users/nipunpathitage/Dev/papershelf/docs/user-guide.md)
- Source build guide: [build_documentation/00_README.md](/Users/nipunpathitage/Dev/papershelf/build_documentation/00_README.md)

## Notes

- Library configuration is stored in the owner's Google Drive `appDataFolder`.
- Each indexed library stores `.paper-manager/index.sqlite` in the Drive root folder.
- The index is rebuildable cache, not authoritative metadata.
- Anonymous browsing is read-only and only works for publicly shared libraries listed in
  `DEFAULT_LIBRARY_FOLDER_IDS`.
