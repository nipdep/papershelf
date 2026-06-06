import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Papershelf",
  description: "Terms of service for Papershelf."
};

export default function TermsPage() {
  return (
    <main className="workspace hero-center">
      <section className="card hero-panel glass-card stack">
        <div className="title-cluster">
          <p className="eyebrow">Legal</p>
          <h1>Terms of Service</h1>
          <p>The basic terms for using Papershelf.</p>
        </div>

        <div className="stack-sm muted">
          <p>Papershelf is provided as-is.</p>
          <p>Users are responsible for the content stored in their Google Drive.</p>
          <p>Papershelf does not claim ownership of uploaded or indexed content.</p>
          <p>Use of Papershelf is at your own risk.</p>
        </div>

        <div className="hero-actions">
          <Link className="button button-secondary" href="/privacy">
            View Privacy Policy
          </Link>
          <Link className="button button-ghost" href="/">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
