import Link from "next/link";

export default function NotFound() {
  return (
    <main className="card stack">
      <p className="eyebrow">Not found</p>
      <h1 className="section-title">This library or paper isn’t available.</h1>
      <p className="muted">
        It may be missing, not indexed yet, or not included in the public or Google Drive-shared
        view available to this session.
      </p>
      <div>
        <Link href="/">Return home</Link>
      </div>
    </main>
  );
}
