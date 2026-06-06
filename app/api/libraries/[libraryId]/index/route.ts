import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getLibraryIndex } from "@/lib/server/library-service";
import { jsonError } from "@/lib/server/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const session = await auth();
    const { libraryId } = await params;
    const index = await getLibraryIndex(session, libraryId);
    return NextResponse.json(index);
  } catch (error) {
    return jsonError(error);
  }
}
