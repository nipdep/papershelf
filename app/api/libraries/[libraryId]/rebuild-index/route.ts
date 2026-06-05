import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { rebuildLibraryIndex } from "@/lib/server/library-service";
import { requireSession } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const session = requireSession(await auth());
    const { libraryId } = await params;
    const result = await rebuildLibraryIndex(session, libraryId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
