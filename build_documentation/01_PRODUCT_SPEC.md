# Product Specification

## Product Name

Working name: **Drive Paper Library**

## One-line Description

A lightweight research paper library interface for Google Drive folders, allowing users to browse, search, upload, move, and read papers without duplicating file storage.

## Product Principle

The app must never become a replacement permission system for Google Drive.

```text
Google Drive owns:
- PDF files
- folder hierarchy
- sharing permissions
- ownership
- trash/version history

The app owns:
- paper-focused UI
- searchable index
- library configuration
- Drive API workflow
```

## Primary Problem

Researchers often store and share papers in Google Drive because it is simple and already integrated with institutional accounts. However, Google Drive is poor at paper-specific browsing and metadata/search workflows.

Zotero-like tools improve paper management, but shared file storage can duplicate files or consume separate storage quota. This app overlays a research library UI on top of existing Drive folders.

## Target Users

- Individual researchers
- Small labs
- Reading groups
- Collaboration teams
- Course groups sharing paper collections

## Core User Stories

### Owner

As the owner, I want to:

- Deploy my own instance from a GitHub fork.
- Configure my Google account as the instance owner.
- Add one or more Drive folders as library roots.
- Rebuild the library index.
- Open Google Drive sharing controls for a folder.
- Remove a library from the app without deleting Drive files.

### User

As a logged-in Google user, I want to:

- See only paper libraries I can access through Google Drive.
- Browse the Drive folder tree as a paper collection.
- Search papers by title, filename, and path.
- Open/read PDFs from Drive.
- Upload, rename, move, or remove papers only when Google Drive permits me to edit.

## Non-goals for MVP

Do not build these in the MVP:

- Zotero-compatible full citation management
- PDF annotation sync
- complex app-owned roles
- app-owned access control lists
- cloud-hosted Postgres/Supabase/Firebase requirement
- real-time collaboration
- embedding/vector search
- AI summarization
- automatic DOI extraction

## MVP Feature List

1. Google login.
2. Owner detection using `SYSTEM_OWNER_EMAIL`.
3. Owner can add/remove Drive library root folders.
4. App stores lightweight config in Drive or Vercel env/local config depending on implementation phase.
5. App scans library folders recursively.
6. App creates `.paper-manager/index.sqlite` inside each library root.
7. App renders folder tree and paper list from SQLite index.
8. App supports search over title, filename, and path.
9. App opens PDFs using Drive preview or Drive web view.
10. App checks Drive permissions before showing edit controls.
11. Users with Drive edit permission can upload/move/rename papers through the app.

## Design Summary

The app is closer to:

```text
Google Drive + Finder/Explorer for Papers
```

not:

```text
Google Drive + full Zotero clone
```
