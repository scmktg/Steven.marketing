import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { portalCredentials } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = portalCredentials();

  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Read-only Server Components cannot set cookies; middleware handles refresh.
        }
      }
    }
  });
}
