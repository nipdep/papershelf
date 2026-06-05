# App Modes and Permission Model

## Final Role Model

The app has only two app-level identities:

```text
Owner
User
```

No separate app-level editor/viewer roles are needed for MVP.

## Why Only Two Roles

Google Drive already knows whether a user can:

- view a folder
- upload into a folder
- rename files
- move files
- trash files
- share files/folders

The app should not duplicate this permission system.

## Owner

Determined by:

```text
SYSTEM_OWNER_EMAIL
```

Owner capabilities:

- access Admin mode
- add library root folders
- remove library root folders from app config
- trigger full index rebuild
- create `.paper-manager` folder
- open Drive sharing page
- see app diagnostics

Owner still needs actual Drive permission for Drive operations.

## User

Any authenticated Google user.

User capabilities:

- see libraries they can access in Drive
- search available indexed papers
- browse folder tree
- open PDFs
- upload/move/rename/delete only if Drive capabilities allow

## Mode Definitions

### Admin Mode

Purpose: configure app instance and library roots.

Visible only to Owner.

Features:

```text
Add library root
Remove library root from app
List configured libraries
Trigger rebuild index
Open Drive sharing UI
View sync/index status
```

### Edit Mode

Purpose: manipulate Drive folders and papers.

Visible to any authenticated user when Drive grants edit capabilities.

Features:

```text
Create subfolder
Upload PDF
Move paper
Rename paper
Trash paper
Rebuild local library index if allowed
```

This is not an app role. It is a UI mode unlocked by Drive permissions.

### View Mode

Purpose: read and search papers.

Visible to any authenticated user with Drive read access.

Features:

```text
Browse folders
Search papers
Open PDF
Copy Drive link
View file location/path
```

## Permission Decision Algorithm

For each library root:

```text
1. Is user authenticated with Google?
   No → redirect to login.

2. Can user access library root folder in Drive?
   No → hide library or show inaccessible notice.

3. Can user add children/edit in Drive?
   Yes → show edit actions.
   No → show read-only view.

4. Is user email SYSTEM_OWNER_EMAIL?
   Yes → show Admin mode.
```

## UI Rule

Never show a destructive action unless Drive capability says it is allowed.

For example:

```text
Trash paper button requires canTrash or equivalent Drive capability.
```

## Security Rule

Server API routes must re-check authorization/capabilities.

Do not trust hidden frontend buttons.
