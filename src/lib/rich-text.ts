import sanitizeHtml from "sanitize-html";

/** The colours a comment may use; rendered through tokens so they read in both themes (see .rich in globals.css). */
export const TEXT_COLORS = ["red", "blue", "green", "yellow", "gray"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "ul", "li", "a", "span"],
  allowedAttributes: { a: ["href"], span: ["data-color", "data-type", "data-id", "data-label"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tag, attribs) => ({ tagName: "a", attribs: { href: attribs.href ?? "", rel: "noopener noreferrer", target: "_blank" } }),
    span: (tag, attribs) => {
      const keep: Record<string, string> = {};
      if (attribs["data-type"] === "mention" && /^[0-9a-f-]{36}$/.test(attribs["data-id"] ?? "")) { keep["data-type"] = "mention"; keep["data-id"] = attribs["data-id"]; if (attribs["data-label"]) keep["data-label"] = attribs["data-label"].slice(0, 80); }
      if ((TEXT_COLORS as readonly string[]).includes(attribs["data-color"] ?? "")) keep["data-color"] = attribs["data-color"];
      return { tagName: "span", attribs: keep };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "span" && Object.keys(frame.attribs).length === 0 && false,
};

/** Comment bodies are stored as a small, sanitised HTML subset: bold, italic, underline, bullets, links, colours, mentions. */
export function sanitizeComment(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS).replace(/<p><\/p>/g, "").trim();
  return clean;
}

/** Plain words for notifications, chat excerpts and @-matching. Works for legacy plain-text bodies too. */
export function plainText(body: string): string {
  if (!isHtml(body)) return body.trim();
  return sanitizeHtml(body.replace(/<\/(p|li)>/g, "$&\n").replace(/<br\s*\/?>/g, "\n"), { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{2,}/g, "\n").trim();
}

/** User ids named through the editor's @-mention chips. */
export function mentionIds(html: string): string[] {
  return [...html.matchAll(/data-type="mention"[^>]*data-id="([0-9a-f-]{36})"/g)].map((m) => m[1]);
}

/** Older comments are plain text; the editor writes HTML. */
export function isHtml(body: string) { return /^\s*<(p|ul|strong|em|u|a|span)\b/i.test(body); }
