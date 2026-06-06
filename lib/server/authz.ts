import { Session } from "next-auth";

import { AppError } from "@/lib/errors";

export function requireSession(session: Session | null) {
  if (!session?.user?.email) {
    throw new AppError("NOT_AUTHENTICATED", "You must sign in first.", 401);
  }

  if (session.user.authError) {
    throw new AppError(
      "NOT_AUTHENTICATED",
      "Your Google session expired or was revoked. Please sign in again.",
      401
    );
  }

  return session;
}

export function requireOwner(session: Session | null) {
  const currentSession = requireSession(session);
  if (!currentSession.user.isOwner) {
    throw new AppError("NOT_OWNER", "Only the configured owner can do that.", 403);
  }

  return currentSession;
}

export function requireDriveAccess(session: Session | null) {
  const currentSession = requireSession(session);
  if (!currentSession.user.hasDriveAccess || !currentSession.user.accessToken) {
    throw new AppError(
      "DRIVE_ACCESS_DENIED",
      "Google Drive access has not been granted for this session.",
      403
    );
  }

  return currentSession;
}

export function canEditFromCapabilities(
  capabilities?: {
    canEdit?: boolean;
    canAddChildren?: boolean;
    canRename?: boolean;
    canDelete?: boolean;
    canTrash?: boolean;
    canMoveItemWithinDrive?: boolean;
  }
): boolean {
  return Boolean(
    capabilities?.canEdit ||
      capabilities?.canAddChildren ||
      capabilities?.canRename ||
      capabilities?.canTrash ||
      capabilities?.canMoveItemWithinDrive
  );
}
