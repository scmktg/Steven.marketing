"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy recovery emails may redirect to the Site URL rather than the callback.
// Preserve their browser-only tokens and route them to the recovery handler.
export function RecoveryRedirect() {
  const router = useRouter();
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.get("type") !== "recovery" ||
        !fragment.get("access_token") || !fragment.get("refresh_token")) return;
    const hash = window.location.hash;
    window.history.replaceState(null, "", "/");
    router.replace("/auth/callback" + hash);
  }, [router]);
  return null;
}
