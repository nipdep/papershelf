# Security and Operations

## Core Security Principle

Google Drive is the permission authority.

The app must not show or allow operations on files/folders that the current Google user cannot access through Drive.

## Do Not Store Secrets in Drive Index

`index.sqlite` must not contain:

```text
OAuth refresh tokens
Google access tokens
API keys
session secrets
private app config secrets
permission ACLs
```

Allowed:

```text
drive_file_id
drive_folder_id
title
filename
path
timestamps
webViewLink
```

## Metadata Leak Consideration

Because `index.sqlite` may reveal paper titles/paths, it should be stored inside the corresponding library root folder:

```text
<Library Root>/.paper-manager/index.sqlite
```

This way, anyone who can read the index file already has access to that library folder.

Avoid one global index containing many private libraries.

## Server-side Permission Checks

Frontend button hiding is not enough.

Every write API route must check:

```text
authenticated user
Drive access to target resource
Drive capability for requested operation
owner status if admin operation
```

## Destructive Operations

Trash/delete must be conservative.

Recommended MVP:

```text
Remove from index: not needed because index is rebuildable
Trash in Drive: require explicit confirmation
Permanent delete: do not implement
```

## Session Storage

Use secure HTTP-only cookies for app session.

Do not put Google refresh tokens into normal browser cookies.

If using Auth.js, follow its adapter/session-token strategy. If no external DB is used, prefer JWT session strategy and request Google access only when needed.

## Refresh Token Concern

If the app needs background sync while user is absent, it needs refresh tokens. That introduces secret storage needs.

MVP avoids this by using manual sync while an authenticated user is present.

This keeps the no-external-database architecture cleaner.

## OAuth Scope Minimization

Start read-only if possible.

Only request broad Drive write scope when implementing edit operations.

## Index Corruption Recovery

If `index.sqlite` is missing/corrupt:

```text
Show index error
Allow Owner/editor to rebuild
Do not delete Drive files
```

## Audit Logging

MVP can skip persistent audit logs.

Optional later:

```text
.paper-manager/audit.ndjson
```

But avoid storing sensitive user data unless necessary.

## Rate Limits and Abuse

Avoid scanning on every page load.

Use index file for fast views.

Manual rebuild should show progress/feedback and avoid repeated concurrent rebuilds.
