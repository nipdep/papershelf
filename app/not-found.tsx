import Link from "next/link";

export default function NotFound() {
  return (
    <main className="card stack">
      <p className="eyebrow">Not found</p>
      <h1 className="section-title">This library or paper isn’t available.</h1>
      <p className="muted">
        It may be missing, not indexed yet, or not shared with your Google account or publicly.
      </p>
      <div>
        <Link href="/">Return home</Link>
      </div>
    </main>
  );
}
