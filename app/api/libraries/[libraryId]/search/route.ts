import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { jsonError } from "@/lib/server/http";
import { searchLibraryIndex } from "@/lib/server/library-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const session = await auth();
    const { libraryId } = await params;
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const results = await searchLibraryIndex(session, libraryId, query);
    return NextResponse.json({ query, results });
  } catch (error) {
    return jsonError(error);
  }
}
