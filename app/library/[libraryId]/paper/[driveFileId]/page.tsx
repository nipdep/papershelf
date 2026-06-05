import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { asAppError } from "@/lib/errors";
import { createSessionDriveClient } from "@/lib/server/library-service";
import { requireSession } from "@/lib/server/authz";

export default async function PaperPage({
  params
}: {
  params: Promise<{ driveFileId: string }>;
}) {
  let session;
  try {
    session = requireSession(await auth());
  } catch (error) {
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      redirect("/");
    }
    throw appError;
  }
  const { driveFileId } = await params;
  try {
    const driveClient = await createSessionDriveClient(session);
    const file = await driveClient.getFileMetadata(driveFileId);

    redirect(
      (file.webViewLink ?? `https://drive.google.com/file/d/${driveFileId}/preview`) as never
    );
  } catch (error) {
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      redirect("/");
    }
    throw appError;
  }
}
