"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { portalConfigured } from "@/lib/supabase/config";

export default function ResetPassword() {
  const router = useRouter();
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!portalConfigured()) { setLoading(false); return; }
    createClient().auth.getUser().then(({ data }) => {
      setValid(Boolean(data.user));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || pending) return;
    setPending(true); setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) setMessage("Could not update your password. Please request a new reset link.");
    else { router.replace("/dashboard"); router.refresh(); }
  }

  return <main className="site">
    <header className="header"><Link href="/" className="logo">steven.marketing</Link></header>
    <section className="center"><div className="login-card">
      <span className="form-kicker">ACCOUNT SECURITY</span>
      <h1>Reset password.</h1>
      {loading ? <p className="description">Checking your recovery link…</p> : valid ?
        <form className="auth-form" onSubmit={submit}>
          <p className="description">Choose a new password for your client account.</p>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" minLength={12} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} />
          <button className="login-action auth-submit" disabled={pending} type="submit">{pending ? "Updating…" : "Update password →"}</button>
        </form> :
        <p className="description">This recovery link is invalid or expired. Request another link from the login page.</p>}
      {message && <p className="auth-message auth-error" role="alert">{message}</p>}
      <Link className="return-link" href="/login">Back to login</Link>
    </div></section>
    <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
  </main>;
}
