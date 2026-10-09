export interface ParsedRow { term: string; definition: string | null; variants: string[]; line: number }
export interface ParseResult { rows: ParsedRow[]; skipped: { line: number; text: string }[] }

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const unbold = (s: string) => clean(s.replace(/^[*_]{1,3}|[*_]{1,3}$/g, ""));

/** "Aarti / Arti" or "Aarti or Arti" in the term slot: the first is the spelling, the rest are variants. */
function splitTerm(raw: string): { term: string; variants: string[] } {
  const parts = raw.split(/\s+\/\s+|\s+or\s+/i).map(clean).filter(Boolean);
  return { term: parts[0] ?? "", variants: parts.slice(1) };
}

/** "(also: a, b)", "(aka a)", "(variants: a; b)" right after the term. */
function takeAlso(rest: string): { variants: string[]; rest: string } {
  const m = rest.match(/^\s*\(\s*(?:also(?: written| spelled)?|aka|a\.k\.a\.|variants?|alt(?:ernate)?s?)\s*[:\-]?\s*([^)]*)\)\s*/i);
  if (!m) return { variants: [], rest };
  return { variants: m[1].split(/[,;]/).map(clean).filter(Boolean), rest: rest.slice(m[0].length) };
}

const DASH = /^\s*(?:–|—|-{1,2}|:|=)\s*/;

function parseBullet(body: string): Omit<ParsedRow, "line"> | null {
  let term: string; let rest: string;
  const bold = body.match(/^(\*\*|__)(.+?)\1\s*(.*)$/);
  if (bold) { term = bold[2]; rest = bold[3]; }
  else {
    const m = body.match(/^(.+?)\s+(?:–|—|-{1,2}|:)\s+(.*)$/) ?? body.match(/^([^:–—]+?):\s*(.*)$/);
    if (!m) return null;
    term = m[1]; rest = m[2];
  }
  const { variants: inline, rest: afterAlso } = takeAlso(rest);
  const definition = clean(afterAlso.replace(DASH, "")) || null;
  const t = splitTerm(unbold(term));
  if (!t.term) return null;
  return { term: t.term, definition, variants: [...t.variants, ...inline] };
}

type Col = "term" | "variants" | "definition" | null;
const colOf = (h: string): Col => /^(word|term|spelling|entry)$/i.test(h) ? "term" : /(also|variant|alternate|other spell|aka)/i.test(h) ? "variants" : /(mean|definition|description|gloss)/i.test(h) ? "definition" : null;

/**
 * Read a glossary written in Markdown. Understands bullets (`- **term** – meaning`, optionally `(also: a, b)`),
 * tables (Word | Also written as | Meaning) and, failing those, headings with a paragraph under each. Anything it
 * cannot read is reported in `skipped` so nothing disappears silently.
 */
export function parseGlossaryMarkdown(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const rows: ParsedRow[] = []; const skipped: ParseResult["skipped"] = [];
  let cols: Col[] | null = null;
  lines.forEach((raw, i) => {
    const line = i + 1; const s = raw.trim();
    if (!s || /^(-{3,}|\*{3,}|_{3,})$/.test(s) || /^#{1,6}\s+\S\s*$/.test(s) || /^#{1,6}\s+/.test(s)) return;
    if (s.startsWith("|")) {
      const cells = s.replace(/^\||\|$/g, "").split("|").map(clean);
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return;
      const asCols = cells.map(colOf);
      if (!cols && asCols.some((c) => c === "term" || c === "definition")) { cols = asCols; return; }
      const layout: Col[] = cols ?? (cells.length >= 3 ? ["term", "variants", "definition"] : ["term", "definition"]);
      const get = (c: Col) => { const idx = layout.indexOf(c); return idx >= 0 ? cells[idx] ?? "" : ""; };
      const t = splitTerm(unbold(get("term")));
      if (!t.term) { skipped.push({ line, text: s }); return; }
      rows.push({ term: t.term, definition: get("definition") || null, variants: [...t.variants, ...get("variants").split(/[,;]/).map(clean).filter(Boolean)], line });
      return;
    }
    const bullet = s.match(/^(?:[-*+•]|\d+[.)])\s+(.*)$/);
    const parsed = bullet ? parseBullet(bullet[1]) : null;
    if (parsed) { rows.push({ ...parsed, line }); return; }
    if (skipped.length < 200) skipped.push({ line, text: s });
  });
  if (rows.length === 0) {
    // Headings mode: "## Aarti" followed by its meaning.
    let cur: ParsedRow | null = null;
    skipped.length = 0;
    lines.forEach((raw, i) => {
      const h = raw.match(/^#{2,6}\s+(.+?)\s*$/);
      if (h && h[1].replace(/[^A-Za-z]/g, "").length > 1) { if (cur) rows.push(cur); const t = splitTerm(unbold(h[1])); cur = { term: t.term, definition: null, variants: t.variants, line: i + 1 }; return; }
      if (cur && raw.trim()) cur.definition = clean(`${cur.definition ?? ""} ${raw.replace(/^[-*]\s+/, "")}`);
    });
    if (cur) rows.push(cur);
  }
  return { rows, skipped };
}
