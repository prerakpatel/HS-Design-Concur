import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/jobs is called by Vercel Cron with no session; the route itself checks the cron bearer token or a Core Admin.
const PUBLIC = ["/login", "/auth", "/awaiting", "/manifest.webmanifest", "/api/status", "/api/storage-check", "/api/jobs", "/sw.js", ...(process.env.DESIGN_PREVIEW === "1" ? ["/preview"] : [])];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // Verifies the session token locally against Supabase's public signing keys (cached), no Auth round trip per request.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ?? null;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = ""; url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone(); url.pathname = "/events"; url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
