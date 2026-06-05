import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { addLibraryForOwner, listLibrariesForSession } from "@/lib/server/library-service";
import { requireOwner, requireSession } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  try {
    const session = requireSession(await auth());
    const libraries = await listLibrariesForSession(session);
    return NextResponse.json({ libraries });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireOwner(await auth());
    const body = await request.json();
    const config = await addLibraryForOwner(session, {
      driveFolderIdOrUrl: String(body.driveFolderId ?? ""),
      displayName: typeof body.displayName === "string" ? body.displayName : undefined
    });
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return jsonError(error);
  }
}
