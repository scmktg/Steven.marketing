"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button type="button" className="sign-out" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      await createClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }}>{busy ? "Signing out…" : "Sign out ↗"}</button>;
}
