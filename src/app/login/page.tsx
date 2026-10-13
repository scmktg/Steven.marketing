import Link from "next/link";

export const metadata = { title: "Client portal | steven.marketing" };

export default function Login() {
  return <main className="site-shell login-shell">
    <header className="masthead"><Link className="wordmark" href="/">steven<span>.</span>marketing</Link><Link href="/" className="header-link">← Back to home</Link></header>
    <section className="login-content">
      <div className="eyebrow"><span className="status-dot" /> PRIVATE CLIENT PORTAL</div>
      <h1>Good to see<br /><em>you here.</em></h1>
      <p className="intro">Your performance dashboard is being prepared. Once secure client access is available, you&apos;ll see Shopify sales, Google Ads spend, commissions and invoices in one place.</p>
      <div className="login-notice" role="status"><strong>Client access coming soon</strong><p>Sign-in isn&apos;t enabled yet. We&apos;ll provide private access when your dashboard is ready.</p></div>
      <a className="primary" href="mailto:hello@steven.marketing?subject=Client%20portal%20access">Request access <span aria-hidden="true">↗</span></a>
    </section>
    <footer><span>© {new Date().getFullYear()} steven.marketing</span><Link href="/">Home ↗</Link></footer>
  </main>;
}
