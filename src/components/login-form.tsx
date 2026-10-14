"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm({ configured, linkError }: { configured: boolean; linkError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || pending) return;
    setMessage("");
    setFailure(false);
    setPending(true);
    try {
      const supabase = createClient();
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback`
        });
        if (error) {
          // Don't show a success message when Supabase has rejected the request.
          if (error.status === 429 || error.code === "over_email_send_rate_limit") {
            setFailure(true);
            setMessage("Password reset email limit reached. Please try again later or contact support.");
            return;
          }
          throw error;
        }
        // Do not disclose whether an email exists.
        setMessage("If that address has an account, a password reset email will arrive shortly.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      setFailure(true);
      setMessage(mode === "login" ? "Unable to sign in. Check your details and try again." : "Unable to send a reset email. Try again shortly.");
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return <div className="notice" role="status">
      <p>Client access is being configured.</p>
      <span>Secure login will be available once the dedicated portal database is connected.</span>
    </div>;
  }

  return <>
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
      {mode === "login" && <>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" placeholder="Enter your password" minLength={8} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
      </>}
      <button className="login-action auth-submit" type="submit" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Sign in →" : "Send reset link →"}
      </button>
    </form>
    {(message || linkError) && <div className={failure || linkError ? "auth-message auth-error" : "auth-message"} role={failure || linkError ? "alert" : "status"}>
      {message || "That sign-in link has expired or is invalid. Please request a new one."}
    </div>}
    <button className="auth-text-action" type="button" onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setMessage(""); setFailure(false); }}>
      {mode === "login" ? "Forgot password?" : "Back to sign in"}
    </button>
  </>;
}
