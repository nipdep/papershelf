import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { removeLibraryForOwner } from "@/lib/server/library-service";
import { requireOwner } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const session = requireOwner(await auth());
    const { libraryId } = await params;
    const config = await removeLibraryForOwner(session, libraryId);
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return jsonError(error);
  }
}
