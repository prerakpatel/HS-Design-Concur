import { TOKENS } from "@/config/design-tokens";
import { ICON_NAMES } from "@/config/icons";
import { RADII, TYPE_SCALE } from "../spec";

export const dynamic = "force-static";

/** The same tokens as data, for tools that are not Tailwind (Figma plugins, native apps, scripts). Public, no sign-in. */
export function GET() {
  const body = {
    name: "Design & Concur by Harisumiran",
    colors: Object.fromEntries(Object.entries(TOKENS).filter(([, v]) => v.startsWith("#"))),
    radius: Object.fromEntries(RADII.map((r) => [r.name, r.px === null ? "9999px" : `${r.px}px`])),
    font: { sans: TOKENS["font-sans"], source: "Google Sans Flex (Google Fonts), weights 400 / 500 / 600" },
    type: TYPE_SCALE.map(({ name, px, line, weight, tracking }) => ({ name, size: `${px}px`, lineHeight: `${line}px`, weight, letterSpacing: tracking ?? "0" })),
    easing: { "out-soft": TOKENS["ease-out-soft"] },
    icons: { family: "Material Symbols Rounded", sizes: [20, 24], names: ICON_NAMES },
  };
  return Response.json(body, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
