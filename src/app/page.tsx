import Link from "next/link";

export default function Home() {
  return (
    <main className="site">
      <header className="header"><Link href="/" className="logo">steven.marketing</Link></header>
      <section className="home-hero" aria-labelledby="hero-title">
        <p className="eyebrow">Independent performance marketing</p>
        <h1 id="hero-title">Built for<br /><em>better business.</em></h1>
        <p className="home-description">Research-led marketing. Measurable growth. We earn our commission when we deliver agreed results.</p>
        <div className="hero-actions">
          <Link className="action action-primary" href="/signup">Sign up as a client <span aria-hidden="true">↗</span></Link>
          <Link className="action action-secondary" href="/login">Client login <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
    </main>
  );
}
