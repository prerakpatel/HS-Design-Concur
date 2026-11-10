import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOKENS, TOKENS_CSS } from "../config/design-tokens.ts";
import { rootTokens, shareableCss } from "../../scripts/design-tokens.mjs";

const css = readFileSync("src/app/globals.css", "utf8");

test("the design library's tokens match globals.css (run `node scripts/design-tokens.mjs` after changing a token)", () => {
  assert.deepEqual(TOKENS, rootTokens(css));
  assert.equal(TOKENS_CSS, shareableCss(css));
});

test("the shared stylesheet carries the light tokens and no dark theme", () => {
  assert.match(TOKENS_CSS, /--brand: #c47050;/);
  assert.match(TOKENS_CSS, /@theme inline/);
  assert.doesNotMatch(TOKENS_CSS, /\.dark\s*\{/);
});
