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
            d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5v-2H5V6h5V4Zm7.59 4.59L19 10l-4 4-1.41-1.41L15.17 11H9V9h6.17l-1.58-1.59L15 6l4 4-1.41 1.41Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </form>
  );
}
