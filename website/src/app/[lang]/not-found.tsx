import Link from 'next/link';

/** Unknown pages inside a language. */
export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap stack" style={{ gap: 16, alignItems: 'flex-start' }}>
        <h1 className="display h2">404</h1>
        <p className="lead">We could not find this page.</p>
        <Link className="btn btn-green" href="/en">Home</Link>
      </div>
    </section>
  );
}
