# API Routes Specification

Assume Next.js App Router route handlers under:

```text
app/api/.../route.ts
```

All API routes require authenticated Google session unless explicitly public.

## Auth Routes

Handled by Auth.js/NextAuth or custom OAuth.

Recommended:

```text
/api/auth/[...nextauth]
```

## GET /api/me

Returns current user and owner status.

Response:

```json
{
  "email": "user@example.com",
  "name": "User Name",
  "image": "https://...",
  "isOwner": true
}
```

## GET /api/libraries

Returns libraries configured for the app and accessible status for current user.

Response:

```json
{
  "libraries": [
    {
      "id": "drive-folder-id",
      "name": "Research Papers",
      "driveFolderId": "drive-folder-id",
      "accessible": true,
      "canEdit": true,
      "indexStatus": "ok"
    }
  ]
}
```

## POST /api/libraries

Owner only.

Add a library root folder.

Request:

```json
{
  "driveFolderId": "...",
  "displayName": "Optional Name"
}
```

Server steps:

```text
1. Require owner.
2. Validate Drive folder exists and user can access it.
3. Ensure `.paper-manager` folder exists.
4. Save config.
5. Optionally trigger index rebuild.
```

## DELETE /api/libraries/:libraryId

Owner only.

Removes library from app config. Does not delete Drive folder.

## POST /api/libraries/:libraryId/rebuild-index

Owner or Drive editor.

Request:

```json
{
  "force": true
}
```

Response:

```json
{
  "ok": true,
  "foldersIndexed": 123,
  "papersIndexed": 456,
  "indexFileId": "...",
  "generatedAt": "2026-06-04T00:00:00.000Z"
}
```

## GET /api/libraries/:libraryId/index

Returns parsed index content or a summary.

For MVP, do not send raw SQLite to browser unless using sql.js client-side.

Recommended response:

```json
{
  "folders": [...],
  "papers": [...]
}
```

## GET /api/libraries/:libraryId/search?q=...

Searches SQLite index.

Response:

```json
{
  "query": "transformer",
  "results": [
    {
      "driveFileId": "...",
      "title": "Attention Is All You Need",
      "fileName": "Attention Is All You Need.pdf",
      "path": "/ML/Transformers/Attention Is All You Need.pdf",
      "driveFolderId": "...",
      "webViewLink": "https://..."
    }
  ]
}
```

## POST /api/libraries/:libraryId/folders

Creates subfolder.

Request:

```json
{
  "parentFolderId": "...",
  "name": "New Folder"
}
```

Server steps:

```text
1. Check user can add children to parent folder.
2. Create Drive folder.
3. Return folder metadata.
4. Mark index stale or trigger rebuild.
```

## POST /api/libraries/:libraryId/upload

Uploads PDF into folder.

Request:

```text
multipart/form-data
- file: PDF
- parentFolderId: Drive folder ID
```

Server steps:

```text
1. Check MIME type / extension.
2. Check Drive canAddChildren.
3. Upload file to Drive.
4. Return Drive file metadata.
5. Mark index stale or update index incrementally.
```

## PATCH /api/papers/:driveFileId

Rename or move paper.

Request:

```json
{
  "title": "Optional new title",
  "fileName": "Optional new filename.pdf",
  "newParentFolderId": "optional-folder-id"
}
```

Server steps:

```text
1. Fetch file metadata and capabilities.
2. Check user can edit/move.
3. Apply Drive update.
4. Mark index stale or update index incrementally.
```

## DELETE /api/papers/:driveFileId

Move paper to Drive trash, if permitted.

Request:

```json
{
  "confirm": true
}
```

Server steps:

```text
1. Check Drive delete/trash capability.
2. Move file to trash.
3. Mark index stale.
```

## Error Format

All errors should return:

```json
{
  "error": {
    "code": "NOT_AUTHORIZED",
    "message": "You do not have access to this folder."
  }
}
```

Suggested codes:

```text
NOT_AUTHENTICATED
NOT_OWNER
DRIVE_ACCESS_DENIED
DRIVE_NOT_FOUND
INDEX_NOT_FOUND
INDEX_STALE
INVALID_REQUEST
UPLOAD_FAILED
REBUILD_FAILED
```
