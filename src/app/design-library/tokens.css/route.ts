import { TOKENS_CSS } from "@/config/design-tokens";

export const dynamic = "force-static";

/** The app's tokens as one stylesheet, for another Tailwind v4 + shadcn/ui app to paste in. Public, no sign-in. */
export function GET() {
  return new Response(TOKENS_CSS, { headers: { "Content-Type": "text/css; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
