"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

// The built-in Supabase recovery email can return either a PKCE ?code=
// or implicit #access_token=...&refresh_token=... to the redirect URL.
// Both must be processed in the browser; URL fragments never reach a server route.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function complete() {
      try {
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.slice(1));
        if (url.searchParams.has("error") || fragment.has("error")) {
          throw new Error("Recovery link rejected");
        }

        const supabase = createClient();
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");
        const code = url.searchParams.get("code");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          // @supabase/ssr may consume the code automatically. If it has already
          // exchanged the code, verify that the resulting user is authenticated.
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            const { data } = await supabase.auth.getUser();
            if (!data.user) throw exchangeError;
          }
        } else {
          // Do not accept a callback that contains no verified credentials.
          throw new Error("No recovery credentials");
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) throw new Error("Recovery session unavailable");

        if (!active) return;
        // Clear one-time tokens and fragments from browser history.
        window.history.replaceState(null, "", "/auth/callback");
        router.replace("/reset-password");
        router.refresh();
      } catch {
        if (!active) return;
        window.history.replaceState(null, "", "/auth/callback");
        setError(true);
      }
    }

    void complete();
    return () => { active = false; };
  }, [router]);

  return <main className="site">
    <header className="header"><Link className="logo" href="/">steven.marketing</Link></header>
    <section className="center"><div className="login-card">
      <span className="form-kicker">ACCOUNT SECURITY</span>
      <h1>{error ? "Link unavailable." : "Verifying link."}</h1>
      <p className="description" role="status">{error
        ? "This password recovery link has expired or cannot be used. Please request a new link."
        : "Confirming your account so you can set a new password…"}</p>
      {error && <Link className="login-action" href="/login">Return to sign in →</Link>}
    </div></section>
    <footer className="footer">© {new Date().getFullYear()} steven.marketing</footer>
  </main>;
}
