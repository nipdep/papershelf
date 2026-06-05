import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/server/authz";
import { jsonError } from "@/lib/server/http";
import { uploadPaper } from "@/lib/server/library-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const session = requireSession(await auth());
    const { libraryId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("INVALID_REQUEST", "A PDF file is required.", 400);
    }

    if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      throw new AppError("INVALID_REQUEST", "Only PDF uploads are supported.", 400);
    }

    const result = await uploadPaper(session, {
      libraryId,
      parentFolderId: String(formData.get("parentFolderId") ?? ""),
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      bytes: new Uint8Array(await file.arrayBuffer())
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
