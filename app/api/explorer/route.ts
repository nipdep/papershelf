import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { jsonError } from "@/lib/server/http";
import {
  loadExplorerDataForPublicAccess,
  loadExplorerDataForSession
} from "@/lib/server/library-service";

export async function GET() {
  try {
    const session = await auth();
    const explorer = session?.user?.hasDriveAccess
      ? await loadExplorerDataForSession(session)
      : await loadExplorerDataForPublicAccess();

    // The browser's IndexedDB cache is intentionally the persistence layer. This response
    // may contain visibility-scoped metadata, so it must never be stored by a shared cache.
    return NextResponse.json(explorer, {
      headers: {
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
