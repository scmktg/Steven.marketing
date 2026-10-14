import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { portalConfigured, portalCredentials } from "./lib/supabase/config";

export async function middleware(request: NextRequest) {
  if (!portalConfigured()) {
    if ((request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/agency"))) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const { url, key } = portalCredentials();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
      }
    }
  });

  // Verify authentication cryptographically: never trust the cookie/session contents.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/agency"))) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/agency/:path*", "/login", "/auth/:path*", "/reset-password"]
};
