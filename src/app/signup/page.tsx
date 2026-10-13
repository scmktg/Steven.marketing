import Link from "next/link";

export const metadata = { title: "Become a client | steven.marketing" };

export default function Signup() {
  return <main className="site">
    <header className="header"><Link href="/" className="logo">steven.marketing</Link></header>
    <section className="center"><div className="login-card">
      <h1>Become a client.</h1>
      <p className="description">Tell us about your business and we’ll discuss what growth could look like together.</p>
      <a className="login-action" href="mailto:hello@steven.marketing?subject=New%20client%20enquiry">Enquire about working together ↗</a>
      <Link className="return-link" href="/">Back to home</Link>
    </div></section>
    <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
  </main>;
}
