import { NextResponse, type NextRequest } from "next/server";
import { getViewer, ORG_COOKIE } from "@/lib/auth";

/** Deep-link entry: switch to the organisation named in `org` (only if the person is a member), then go to `to`. */
export async function GET(request: NextRequest) {
  const org = request.nextUrl.searchParams.get("org");
  const to = request.nextUrl.searchParams.get("to") ?? "/events";
  // Only an on-site path: a link must never send someone to another website.
  const target = /^\/(?!\/)/.test(to) ? to : "/events";
  const response = NextResponse.redirect(new URL(target, request.url));
  if (org) {
    const viewer = await getViewer();
    if (viewer?.orgs.some((o) => o.slug === org)) response.cookies.set(ORG_COOKIE, org, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}
