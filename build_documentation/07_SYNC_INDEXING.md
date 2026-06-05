# Sync and Indexing Operation Sheet

## MVP Sync Strategy

Start with manual rebuild.

```text
Owner/Edit-capable user clicks Rebuild Index
→ app scans Drive recursively
→ app generates index.sqlite
→ app uploads it to .paper-manager/index.sqlite
```

Avoid automatic Drive webhooks in MVP.

## Recursive Scan Algorithm

Input:

```text
libraryRootFolderId
```

Algorithm:

```text
queue = [{ id: libraryRootFolderId, path: "", depth: 0 }]
folders = []
papers = []

while queue not empty:
  current = queue.pop()
  list children where current.id in parents and trashed=false

  for child in children:
    if child is folder and child.name != ".paper-manager":
       childPath = current.path + "/" + child.name
       folders.push(child metadata + childPath)
       queue.push(child)

    if child is PDF:
       paperPath = current.path + "/" + child.name
       title = deriveTitle(child.name)
       papers.push(child metadata + paperPath + title)
```

## Skip Rules

Do not index:

```text
.paper-manager/
trashed files
non-PDF files in MVP
Google Docs/Sheets/Slides
shortcuts initially unless explicitly supported later
```

## Title Derivation

```ts
function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_]+/g, ' ')
    .trim();
}
```

Be conservative. Do not over-normalize.

## SQLite Build Steps

```text
1. Create temp local path: /tmp/index-<libraryId>-<timestamp>.sqlite
2. Open SQLite database.
3. Create tables.
4. Insert app_meta.
5. Insert folders.
6. Insert papers.
7. Populate FTS table if available.
8. Close DB.
9. Upload to Drive.
10. Delete temp file.
```

## Upload Strategy

Find `.paper-manager/index.sqlite`.

If exists:

```text
Drive files.update with new media
```

If missing:

```text
Drive files.create inside .paper-manager
```

## Staleness Strategy

MVP can show:

```text
Index generated at: <timestamp>
```

After upload/move/rename/delete through the app:

Option A:

```text
Immediately trigger rebuild.
```

Option B:

```text
Mark index stale and show Rebuild needed.
```

Recommended MVP:

```text
For upload/rename/move: update Drive, then trigger rebuild if library is small.
For large libraries: mark stale.
```

## Future Auto-sync

Later add:

```text
Vercel Cron every 15-60 minutes
Drive Changes API
Drive push notifications
incremental indexing
```

But do not start here.

## Race Condition Policy for MVP

Because `index.sqlite` is rebuildable cache, race conditions are tolerable for reads.

For writes:

```text
Drive operation succeeds first.
Index may be stale after.
User can rebuild index.
```

Never let index write failure roll back Drive file changes.

## Large Library Considerations

If scanning becomes slow:

- paginate Drive API results properly
- batch inserts into SQLite transactions
- avoid downloading PDFs
- request only required Drive fields
- add incremental scan later
