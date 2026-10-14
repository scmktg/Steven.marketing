import Link from "next/link";

export default function Home() {
  return (
    <main className="site">
      <header className="header"><Link href="/" className="logo">steven.marketing</Link></header>
      <section className="home-hero" aria-labelledby="hero-title">
        <p className="eyebrow">Performance based marketing</p>
        <h1 id="hero-title">Built for<br /><em>better business.</em></h1>
        <p className="home-description">We analyse your products, customers and competitors to implement, measure and optimise tailored marketing campaigns. Commissions are only paid on results achieved above your monthly baseline.</p>
        <div className="hero-actions">
          <Link className="action action-primary" href="/signup">Sign up as a client <span aria-hidden="true">↗</span></Link>
          <Link className="action action-secondary" href="/login">Client login <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
    </main>
  );
}
