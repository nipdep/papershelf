# Google Drive and OAuth Operation Sheet

## OAuth Goal

Users authenticate with Google so the app can:

- identify their Gmail address
- check which Drive folders/files they can access
- list Drive folders/files
- upload/move/rename files when Drive permits

## Recommended OAuth Scopes

For early MVP, choose the narrowest scopes that still work.

### Option A: Read-only MVP

```text
openid
email
profile
https://www.googleapis.com/auth/drive.readonly
```

Allows browsing/searching/opening accessible Drive files.

### Option B: Edit-capable MVP

```text
openid
email
profile
https://www.googleapis.com/auth/drive
```

Allows folder creation, file upload, move, rename, trash, and permission inspection.

### Option C: Safer but more limited

```text
https://www.googleapis.com/auth/drive.file
```

This may be too restrictive for indexing arbitrary pre-existing folders unless the user explicitly opens files/folders with the app.

## Suggested MVP Choice

Start with:

```text
openid email profile drive.readonly
```

Then add edit support with a separate consent path requiring:

```text
drive
```

## Environment Variables

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
AUTH_URL=
SYSTEM_OWNER_EMAIL=owner@example.com

# Legacy aliases also work:
# NEXTAUTH_SECRET=
# NEXTAUTH_URL=
```

Optional:

```env
DEFAULT_LIBRARY_FOLDER_IDS=
```

## Owner Detection

The instance owner is not determined by Vercel URL or GitHub owner.

Use:

```text
SYSTEM_OWNER_EMAIL
```

At login:

```ts
isOwner = session.user.email.toLowerCase() === process.env.SYSTEM_OWNER_EMAIL.toLowerCase()
```

## Drive Library Root Selection

Owner flow:

```text
1. Owner opens Admin page.
2. Owner clicks Add Library.
3. App opens Google Picker or accepts pasted Drive folder URL/ID.
4. App validates folder access.
5. App creates/updates app config.
6. App can create `.paper-manager/` folder if missing.
7. App can trigger initial index rebuild.
```

## Folder URL Parsing

Support pasted URLs like:

```text
https://drive.google.com/drive/folders/<FOLDER_ID>
```

Extract `<FOLDER_ID>`.

## Drive API Operations Needed

### Get file/folder metadata

Fields:

```text
id, name, mimeType, parents, modifiedTime, createdTime, size, webViewLink, capabilities
```

### List children of a folder

Query:

```text
'<folderId>' in parents and trashed = false
```

Useful filters:

```text
mimeType = 'application/pdf'
mimeType = 'application/vnd.google-apps.folder'
```

### Create folder

Metadata:

```json
{
  "name": ".paper-manager",
  "mimeType": "application/vnd.google-apps.folder",
  "parents": ["LIBRARY_ROOT_ID"]
}
```

### Upload index.sqlite

Upload or update binary file with MIME type:

```text
application/vnd.sqlite3
```

If MIME support is awkward, use:

```text
application/octet-stream
```

### Open PDF

Use Drive `webViewLink`, or construct:

```text
https://drive.google.com/file/d/<drive_file_id>/preview
```

## Permission Handling

Do not store permissions in SQLite.

Before showing edit actions, inspect Drive file/folder capabilities when possible:

```text
capabilities.canEdit
capabilities.canAddChildren
capabilities.canDelete
capabilities.canRename
```

The UI should be capability-based:

```text
if Drive says canAddChildren => show Upload button
if Drive says canEdit/canMoveItemWithinDrive => show Move/Rename
if Drive says cannot edit => read-only UI
```
