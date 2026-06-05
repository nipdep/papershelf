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
      <button className="button button-ghost" type="submit">
        Sign out
      </button>
    </form>
  );
}
