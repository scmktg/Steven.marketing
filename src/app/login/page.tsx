import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { portalConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Client login | steven.marketing" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const configured = portalConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect("/dashboard");
  }
  const query = await searchParams;
  return <main className="site">
    <header className="header"><Link href="/" className="logo">steven.marketing</Link></header>
    <section className="center"><div className="login-card">
      <span className="form-kicker">PRIVATE CLIENT PORTAL</span>
      <h1>Welcome back.</h1>
      <p className="description">Sign in to view your business performance, campaigns and commissions.</p>
      <LoginForm configured={configured} linkError={query.error === "link"} />
      <Link className="return-link" href="/">← Back to home</Link>
    </div></section>
    <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
  </main>;
}
