import { isConfiguredForGoogleAuth } from "@/lib/env";
import { signIn, signOut } from "@/auth";

export function SignInButton() {
  if (!isConfiguredForGoogleAuth()) {
    return (
      <button className="button button-secondary" disabled>
        Google auth not configured
      </button>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button className="button" type="submit">
        Sign in with Google
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <button
        aria-label="Sign out"
        className="shell-icon-button"
        title="Sign out"
        type="submit"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M14 4h-4a2 2 0 0 0-2 2v3h2V6h4v12h-4v-3H8v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm3.59 7-2.29-2.29-1.41 1.41L13.17 11H6v2h7.17l.71.88 1.41 1.41L17.59 13H20v-2h-2.41Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </form>
  );
}
