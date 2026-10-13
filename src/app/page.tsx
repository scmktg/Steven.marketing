import Link from "next/link";

export default function Home() {
  return (
    <main className="site-shell">
      <header className="masthead">
        <Link href="/" className="wordmark">steven.marketing</Link>
        <Link href="/login" className="nav-link">Client login <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Independent performance marketing</p>
        <h1 id="hero-title">Growth, measured.</h1>
        <p className="intro">We research, execute and optimise marketing that grows your business. Our commission is tied to agreed results.</p>
        <a className="button button-dark" href="mailto:hello@steven.marketing?subject=Let%27s%20talk%20business">Let's talk business <span aria-hidden="true">↗</span></a>
      </section>

      <section className="client-section" aria-labelledby="client-title">
        <div>
          <p className="eyebrow">For clients</p>
          <h2 id="client-title">Your numbers. In one place.</h2>
          <p>Sales, advertising spend, commissions and invoices — a clear view of your business performance. Private dashboard access is coming soon.</p>
        </div>
        <Link href="/login" className="button button-outline">Client login <span aria-hidden="true">→</span></Link>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} steven.marketing</span>
        <a href="mailto:hello@steven.marketing">Contact</a>
      </footer>
    </main>
  );
}
