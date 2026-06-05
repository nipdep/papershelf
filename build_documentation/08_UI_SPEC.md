# UI Specification

## Pages

### `/`

Landing/dashboard page.

States:

```text
Not logged in → show sign in with Google
Logged in → show accessible libraries
Owner → show Admin link
```

### `/admin`

Owner only.

Sections:

```text
Instance owner info
Configured libraries
Add library form
Rebuild index actions
Open Drive sharing links
Diagnostics
```

### `/library/[libraryId]`

Main library view.

Layout:

```text
Top bar: library name, search, sync status
Left panel: folder tree
Main panel: paper list/table
Right/optional: selected paper details
```

### `/library/[libraryId]/paper/[driveFileId]`

Paper detail/open page.

MVP can redirect/open Drive preview.

Optional embedded preview:

```html
<iframe src="https://drive.google.com/file/d/<id>/preview" />
```

## Components

### LibraryCard

Shows:

```text
Library name
Access status
Can edit badge
Index generated timestamp
Open button
```

### FolderTree

Shows arbitrary-depth folder hierarchy from SQLite `folders` table.

Features:

```text
Expand/collapse folders
Click folder to filter papers
Show paper count per folder optional
```

### PaperTable

Columns:

```text
Title
File name
Path
Modified time
Actions
```

Actions:

```text
Open
Copy link
Rename if canEdit
Move if canEdit
Trash if canEdit and permitted
```

### SearchBox

Searches:

```text
title
file_name
path
```

UI behavior:

```text
Debounced search
Empty query returns folder-filtered list
```

### UploadButton

Visible when current folder `canAddChildren` is true.

Accept:

```text
application/pdf
.pdf
```

### RebuildIndexButton

Visible to:

```text
Owner
or Drive editor on library root
```

## UI Modes

### View Mode

Default for all accessible users.

Contains:

```text
browse
search
open
copy link
```

### Edit Mode

Not a separate role. It appears when Drive capabilities allow editing.

Contains:

```text
upload
create folder
rename
move
trash
```

### Admin Mode

Owner only.

Contains:

```text
add/remove libraries
rebuild index
configuration
```

## Empty States

### No libraries configured

Owner:

```text
No libraries yet. Add a Google Drive folder to begin.
```

User:

```text
No paper libraries are configured for this app yet.
```

### No accessible libraries

```text
No accessible libraries found. Ask the library owner to share the Drive folder with your Google account.
```

### Index missing

```text
This library has not been indexed yet.
```

Owner/edit-capable user sees:

```text
Rebuild Index button
```

### Index stale

```text
This index may be stale. Rebuild to refresh the paper list.
```

## Design Tone

Keep it simple and file-browser-like.

Avoid making it look like a complex reference manager in MVP.
