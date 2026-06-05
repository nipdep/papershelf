import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createSubfolder } from "@/lib/server/library-service";
import { requireSession } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const session = requireSession(await auth());
    const { libraryId } = await params;
    const body = await request.json();
    const folder = await createSubfolder(session, {
      libraryId,
      parentFolderId: String(body.parentFolderId ?? ""),
      name: String(body.name ?? "")
    });
    return NextResponse.json(folder);
  } catch (error) {
    return jsonError(error);
  }
}
