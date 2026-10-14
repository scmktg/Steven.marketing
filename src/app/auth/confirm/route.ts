import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { portalConfigured } from "@/lib/supabase/config";

// Supabase invitation emails can use:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!portalConfigured() || !hash || !type || !["invite", "recovery", "email"].includes(type)) {
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: hash,
    type: type as "invite" | "recovery" | "email"
  });

  if (error) return NextResponse.redirect(new URL("/login?error=link", origin));
  return NextResponse.redirect(new URL(type === "email" ? "/dashboard" : "/reset-password", origin));
}
