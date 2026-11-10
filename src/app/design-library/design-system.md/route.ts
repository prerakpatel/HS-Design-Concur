import { designSystemMarkdown } from "../spec";

export const dynamic = "force-static";

/** The whole design system as one Markdown brief. Public, no sign-in. */
export function GET() {
  return new Response(designSystemMarkdown(), { headers: { "Content-Type": "text/markdown; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
