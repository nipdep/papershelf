# Vercel Deployment Operation Sheet

## Deployment Model

Each deployment is a standalone app instance.

```text
one GitHub fork
one Vercel project
one Google OAuth client
one owner Gmail
one or more Drive library folders
```

## Required Services

- GitHub repo
- Vercel account
- Google Cloud project
- Google OAuth client
- Google Drive API enabled

## Vercel Environment Variables

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-app.vercel.app
SYSTEM_OWNER_EMAIL=owner@example.com
```

Optional:

```env
DEFAULT_LIBRARY_FOLDER_IDS=
```

## Google Cloud Setup

1. Create or select Google Cloud project.
2. Enable Google Drive API.
3. Configure OAuth consent screen.
4. Create OAuth client ID.
5. Application type: Web application.
6. Add authorized redirect URI:

```text
https://your-app.vercel.app/api/auth/callback/google
```

For local development:

```text
http://localhost:3000/api/auth/callback/google
```

## Vercel Setup

1. Import GitHub repo into Vercel.
2. Set environment variables.
3. Deploy.
4. Confirm `NEXTAUTH_URL` matches production URL.
5. Sign in with `SYSTEM_OWNER_EMAIL`.
6. Open Admin page.
7. Add Drive library root.
8. Rebuild index.

## Local Development

`.env.local`:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=dev-secret-change-me
NEXTAUTH_URL=http://localhost:3000
SYSTEM_OWNER_EMAIL=owner@example.com
```

Run:

```bash
npm install
npm run dev
```

## Vercel URL Note

Do not use Vercel URL to determine owner. Vercel project URLs are deployment/project identifiers, not reliable ownership identifiers.

Owner identity must come from:

```text
SYSTEM_OWNER_EMAIL + Google authenticated email
```

## No Persistent Local SQLite

Vercel serverless local filesystem is temporary.

Allowed:

```text
Create /tmp/index.sqlite during one request
Upload to Drive
Discard
```

Not allowed:

```text
Keep app database on Vercel filesystem
```
