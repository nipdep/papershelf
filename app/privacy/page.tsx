import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Papershelf",
  description: "Privacy policy for Papershelf."
};

export default function PrivacyPage() {
  return (
    <main className="workspace hero-center">
      <section className="card hero-panel glass-card stack">
        <div className="title-cluster">
          <p className="eyebrow">Legal</p>
          <h1>Privacy Policy</h1>
          <p>How Papershelf uses Google Sign-In and Google Drive data.</p>
        </div>

        <div className="stack-sm muted">
          <p>Papershelf uses Google Sign-In to authenticate users.</p>
          <p>
            Papershelf only accesses Google Drive resources that users explicitly grant
            access to.
          </p>
          <p>Papershelf does not sell, share, or distribute user data.</p>
          <p>Papershelf stores only the minimal application data required for operation.</p>
          <p>
            For privacy-related questions, contact{" "}
            <a className="inline-link" href="mailto:nipun1deelaka@gmail.com">
              nipun1deelaka@gmail.com
            </a>
            .
          </p>
        </div>

        <div className="hero-actions">
          <Link className="button button-secondary" href="/terms">
            View Terms of Service
          </Link>
          <Link className="button button-ghost" href="/">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
