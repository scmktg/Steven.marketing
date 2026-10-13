import Link from "next/link";

export const metadata = { title: "Client login | steven.marketing" };

export default function Login() {
  return <main className="site">
    <header className="header"><Link href="/" className="logo">steven.marketing</Link></header>
    <section className="center"><div className="login-card">
      <h1>Client login</h1>
      <p className="description">Your private client dashboard.</p>
      <div className="notice" role="status"><p>Secure sign-in is coming soon.</p><span>Client accounts are not yet active.</span></div>
      <a className="login-action" href="mailto:hello@steven.marketing?subject=Client%20portal%20access">Request access ↗</a>
      <Link className="return-link" href="/">Back to home</Link>
    </div></section>
    <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
  </main>;
}
