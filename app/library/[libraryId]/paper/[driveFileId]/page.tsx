import { notFound, redirect } from "next/navigation";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";

import { auth } from "@/auth";
import { asAppError } from "@/lib/errors";
import { isConfiguredForPublicDriveBrowsing } from "@/lib/env";
import {
  createPublicDriveClient,
  createSessionDriveClient
} from "@/lib/server/library-service";
import { requireSession } from "@/lib/server/authz";

export default async function PaperPage({
  params
}: {
  params: Promise<{ driveFileId: string }>;
}) {
  let session = null;
  try {
    session = requireSession(await auth());
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code !== "NOT_AUTHENTICATED") {
      throw appError;
    }
  }
  const { driveFileId } = await params;
  try {
    const driveClient = session?.user.hasDriveAccess
      ? await createSessionDriveClient(session)
      : isConfiguredForPublicDriveBrowsing()
        ? await createPublicDriveClient()
        : null;

    if (!driveClient) {
      redirect("/");
    }

    const file = await driveClient.getFileMetadata(driveFileId);

    redirect(
      (file.webViewLink ?? `https://drive.google.com/file/d/${driveFileId}/preview`) as never
    );
  } catch (error) {
    unstable_rethrow(error);
    const appError = asAppError(error);
    if (appError.code === "NOT_AUTHENTICATED") {
      redirect("/");
    }
    if (appError.code === "DRIVE_NOT_FOUND") {
      notFound();
    }
    throw appError;
  }
}
