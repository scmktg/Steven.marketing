import { createBrowserClient } from "@supabase/ssr";
import { portalCredentials } from "./config";

export function createClient() {
  const { url, key } = portalCredentials();
  return createBrowserClient(url, key);
}
