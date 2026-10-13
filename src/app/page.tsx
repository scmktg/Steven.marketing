import Link from "next/link";

export default function Home() {
  return (
    <main className="site">
      <header className="header">
        <Link href="/" className="logo" aria-label="steven.marketing home">steven.marketing</Link>
      </header>
      <section className="center" aria-labelledby="login-heading">
        <div className="login-card">
          <h1 id="login-heading">Client login</h1>
          <p className="description">Your private client dashboard.</p>
          <div className="notice" role="status">
            <p>Secure login is coming soon.</p>
            <span>Request access to get started.</span>
          </div>
          <a className="login-action" href="mailto:hello@steven.marketing?subject=Client%20portal%20access">Request access <span aria-hidden="true">↗</span></a>
        </div>
      </section>
      <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
    </main>
  );
}
