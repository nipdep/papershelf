import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createSessionDriveClient } from "@/lib/server/library-service";
import { requireSession } from "@/lib/server/authz";

export default async function PaperPage({
  params
}: {
  params: Promise<{ driveFileId: string }>;
}) {
  const session = requireSession(await auth());
  const { driveFileId } = await params;
  const driveClient = await createSessionDriveClient(session);
  const file = await driveClient.getFileMetadata(driveFileId);

  redirect(
    (file.webViewLink ?? `https://drive.google.com/file/d/${driveFileId}/preview`) as never
  );
}
