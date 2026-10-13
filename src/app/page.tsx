import Link from "next/link";

export default function Home() {
  return (
    <main className="site-shell">
      <header className="masthead">
        <Link className="wordmark" href="/" aria-label="steven.marketing home">steven<span>.</span>marketing</Link>
        <Link href="/login" className="header-link">Client login <span aria-hidden="true">↗</span></Link>
      </header>
      <section className="hero" aria-labelledby="headline">
        <div className="eyebrow"><span className="status-dot" /> INDEPENDENT PERFORMANCE MARKETING</div>
        <h1 id="headline">Built for<br /><em>better business.</em></h1>
        <p className="intro">We study your business, find the opportunities, execute the campaigns and measure what matters. Our compensation is tied to agreed results.</p>
        <div className="hero-actions">
          <a className="primary" href="mailto:hello@steven.marketing?subject=Let's%20talk%20business">Let&apos;s talk business <span aria-hidden="true">↗</span></a>
          <Link className="quiet-link" href="/login">Already a client? Sign in <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <section className="portal-panel" aria-label="Client portal">
        <div><p className="section-label">CLIENT PORTAL</p><h2>Everything in one place.</h2><p>A single view of sales, advertising spend, performance, commission and invoices. Your private dashboard is on the way.</p></div>
        <Link href="/login" className="portal-link">Client login <span aria-hidden="true">↗</span></Link>
      </section>
      <footer><span>© {new Date().getFullYear()} steven.marketing</span><a href="mailto:hello@steven.marketing">Get in touch ↗</a></footer>
    </main>
  );
}
