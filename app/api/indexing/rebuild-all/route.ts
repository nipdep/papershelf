import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { requireSession } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";
import { rebuildAccessibleLibraryIndexes } from "@/lib/server/library-service";

export async function POST() {
  try {
    const session = requireSession(await auth());
    const result = await rebuildAccessibleLibraryIndexes(session);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
