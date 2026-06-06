export const GOOGLE_BASE_SCOPES = ["openid", "email", "profile"] as const;

export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.appdata"
] as const;

export function createGoogleScopeString(scopes: readonly string[]): string {
  return scopes.join(" ");
}

export function createDriveAuthorizationParams() {
  return {
    prompt: "consent",
    access_type: "offline",
    response_type: "code",
    include_granted_scopes: "true",
    scope: createGoogleScopeString([...GOOGLE_BASE_SCOPES, ...GOOGLE_DRIVE_SCOPES])
  };
}

export function hasDriveScope(scope?: string | null): boolean {
  if (!scope) {
    return false;
  }

  const grantedScopes = scope.split(/\s+/).filter(Boolean);
  return GOOGLE_DRIVE_SCOPES.some((requiredScope) => grantedScopes.includes(requiredScope));
}
