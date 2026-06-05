# Drive Paper Library — Build Documentation

This folder contains the complete build specification and operation sheets for a lightweight Google Drive-backed research paper management web app.

The intended workflow is:

1. Fork the app repo.
2. Deploy to Vercel.
3. Configure Google OAuth and environment variables.
4. Add one or more Google Drive library root folders.
5. Use the app as a searchable paper collection overlay on top of Google Drive.

Core architecture:

```text
Google Drive = source of truth for PDFs, folders, sharing, permissions
Next.js/Vercel app = UI, auth flow, Drive operations, search/read interface
index.sqlite in Drive = lightweight rebuildable metadata/search index
```

Recommended reading order:

1. `01_PRODUCT_SPEC.md`
2. `02_ARCHITECTURE.md`
3. `03_DATA_MODEL_SQLITE.md`
4. `04_GOOGLE_DRIVE_OAUTH.md`
5. `05_APP_MODES_AND_PERMISSIONS.md`
6. `06_API_ROUTES.md`
7. `07_SYNC_INDEXING.md`
8. `08_UI_SPEC.md`
9. `09_DEPLOYMENT_VERCEL.md`
10. `10_SECURITY_OPERATIONS.md`
11. `11_CODEX_BUILD_PLAN.md`
12. `12_ACCEPTANCE_CHECKLIST.md`
