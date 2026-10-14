import "server-only";
import { redirect } from "next/navigation";
import { portalConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function requireAgencyAdmin() {
  if (!portalConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: verified, error: authError } = await supabase.auth.getClaims();
  const userId = verified?.claims?.sub;
  if (authError || !userId) redirect("/login");
  const { data: admin, error } = await supabase.from("agency_admins")
    .select("user_id").eq("user_id", userId).maybeSingle();
  if (error || !admin) redirect("/dashboard");
  return { supabase, userId };
}
