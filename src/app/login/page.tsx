import Link from "next/link";

export const metadata = { title: "Client login | steven.marketing" };

export default function Login() {
  return (
    <main className="site-shell">
      <header className="masthead">
        <Link href="/" className="wordmark">steven.marketing</Link>
        <Link href="/" className="nav-link">← Home</Link>
      </header>
      <section className="login-content">
        <p className="eyebrow">Client portal</p>
        <h1>Welcome back.</h1>
        <p className="intro">A private view of your sales, ad spend, commissions and invoices.</p>
        <div className="login-notice" role="status">
          <strong>Client access coming soon.</strong>
          <p>Secure sign-in is not enabled yet. Request access and we’ll be in touch when your dashboard is ready.</p>
        </div>
        <a className="button button-dark" href="mailto:hello@steven.marketing?subject=Client%20portal%20access">Request access <span aria-hidden="true">↗</span></a>
      </section>
      <footer><span>© {new Date().getFullYear()} steven.marketing</span><Link href="/">Home</Link></footer>
    </main>
  );
}
