import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";
import { trashPaperInLibrary, updatePaperMetadata } from "@/lib/server/library-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ driveFileId: string }> }
) {
  try {
    const session = requireSession(await auth());
    const { driveFileId } = await params;
    const body = await request.json();
    const result = await updatePaperMetadata(session, {
      driveFileId,
      libraryId: String(body.libraryId ?? ""),
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
      newParentFolderId:
        typeof body.newParentFolderId === "string" ? body.newParentFolderId : undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ driveFileId: string }> }
) {
  try {
    const session = requireSession(await auth());
    const { driveFileId } = await params;
    const body = await request.json().catch(() => ({}));
    const libraryId = String(body.libraryId ?? "");
    if (!libraryId) {
      throw new AppError("INVALID_REQUEST", "libraryId is required.", 400);
    }

    await trashPaperInLibrary(session, {
      driveFileId,
      libraryId,
      confirm: Boolean(body.confirm)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
