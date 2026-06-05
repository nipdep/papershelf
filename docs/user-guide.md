# User Guide

## What Papershelf Does

Papershelf gives you a small paper-library view over Google Drive. Your PDFs stay in Drive. Sharing and edit access still come from Drive.

## Sign In

1. Open the app.
2. Click `Sign in with Google`.
3. Use the same Google account that has access to the shared paper folders.

## Home Page

After signing in, the home page shows the libraries you can access.

Each card tells you:

- whether the library is accessible
- whether your Drive account can edit it
- whether the index is present
- when the index was last generated

## Admin Page

Only the configured owner email can open `/admin`.

Owner tasks:

1. Paste a Google Drive folder URL or folder ID.
2. Optionally set a display name.
3. Add the library to the app.
4. Rebuild the library index when needed.
5. Remove a library from the app without deleting Drive files.

## Library Page

The library page provides:

- folder tree
- paper list
- search by title, file name, or path
- open paper in Drive preview

If you only have read access, you can browse and open papers.

If Drive allows editing, you can also:

- create subfolders
- upload PDFs
- rename papers
- move papers
- trash papers
- rebuild the index

## Permissions

Papershelf does not create its own editor/viewer roles.

It follows Google Drive:

- if Drive says you can edit, edit actions appear
- if Drive says you can only view, the UI stays read-only
- all edit operations are checked again on the server

## Rebuilding the Index

Use `Rebuild index` when:

- a library is first added
- files were changed outside the app
- the app says the index is missing or stale

The rebuild scans folders and PDFs, then writes `.paper-manager/index.sqlite` into the Drive library root.

## Troubleshooting

### No libraries appear

- Ask the owner to add a library in `/admin`.
- Make sure the Drive folder is shared with your Google account.

### A library says index missing

- Ask the owner or an editor to click `Rebuild index`.

### Edit actions are missing

- Your Google account probably has read-only Drive access for that library or folder.
