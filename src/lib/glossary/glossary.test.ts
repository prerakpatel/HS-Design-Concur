import { test } from "node:test";
import assert from "node:assert/strict";
import { termKey, soundKey } from "./sound.ts";
import { indexEntries, searchGlossary } from "./search.ts";
import { parseGlossaryMarkdown } from "./parse.ts";

test("termKey ignores case, spaces, hyphens and accents", () => {
  assert.equal(termKey("Das-na-Das"), "dasnadas");
  assert.equal(termKey("Shayan Aarti"), "shayanaarti");
  assert.equal(termKey("Satsaṅg"), "satsang");
});

test("spellings people use interchangeably share a sound key", () => {
  const same = [
    ["aarti", "arti"], ["Bhagwan", "Bhagvan", "Bhagwaan"], ["pooja", "puja"], ["gnaan", "gyan", "jnana"],
    ["satsang", "satsangh"], ["Swaminarayan", "Swaminarayana"], ["daal", "dal"], ["Shobha", "Sobha"], ["Dhun", "Dun"], ["chitt", "chit"],
  ];
  for (const group of same) for (const w of group) assert.equal(soundKey(w), soundKey(group[0]), `${w} should sound like ${group[0]}`);
});

test("different words keep different keys", () => {
  assert.notEqual(soundKey("seva"), soundKey("sabha"));
  assert.notEqual(soundKey("mandir"), soundKey("mandal"));
  assert.notEqual(soundKey("bhakti"), soundKey("mukti"));
});

const entries = [
  { id: "1", term: "aarti", definition: "A religious ritual with an oil lamp", variants: ["arti"] },
  { id: "2", term: "ahamkar", definition: "Ego", variants: [] },
  { id: "3", term: "maan", definition: "Ego", variants: [] },
  { id: "4", term: "man", definition: "mind", variants: [] },
  { id: "5", term: "prasad", definition: "Consecrated food", variants: ["prasadam"] },
  { id: "6", term: "gnaan", definition: "Knowledge", variants: [] },
  { id: "7", term: "Bhagwan", definition: "God", variants: [] },
];
const index = indexEntries(entries);
const top = (q: string) => searchGlossary(q, index)[0]?.entry.term;

test("search finds the approved spelling however it is typed", () => {
  assert.equal(top("Arti"), "aarti");
  assert.equal(top("AARTI"), "aarti");
  assert.equal(top("gyan"), "gnaan");
  assert.equal(top("bhagvan"), "Bhagwan");
  assert.equal(top("prasadam"), "prasad");
  assert.equal(top("aart"), "aarti");
});

test("exact spelling outranks a sound-alike", () => {
  assert.equal(top("man"), "man");
  assert.equal(top("maan"), "maan");
  assert.deepEqual(searchGlossary("man", index).slice(0, 2).map((h) => h.entry.term).sort(), ["maan", "man"]);
});

test("search looks in meanings and says nothing for nonsense", () => {
  assert.deepEqual(searchGlossary("ego", index).map((h) => h.entry.term).sort(), ["ahamkar", "maan"]);
  assert.equal(searchGlossary("zzzzqq", index).length, 0);
  assert.equal(searchGlossary("   ", index).length, 0);
});

test("parses bullets like the BSA book glossary", () => {
  const { rows, skipped } = parseGlossaryMarkdown([
    "- **aagna** – Command (generally given by Guruhari Swamiji or a bhagwadi)",
    "- **maha-kaaran** – ",
    "- **Akshardham** – Abode where God resides; the soul’s final destination",
    "- **dhabbo** – A loving pat on the back (Dhabba is plural)",
    "Some stray sentence.",
  ].join("\n"));
  assert.deepEqual(rows.map((r) => r.term), ["aagna", "maha-kaaran", "Akshardham", "dhabbo"]);
  assert.equal(rows[0].definition, "Command (generally given by Guruhari Swamiji or a bhagwadi)");
  assert.equal(rows[1].definition, null);
  assert.equal(rows[3].definition, "A loving pat on the back (Dhabba is plural)");
  assert.equal(skipped.length, 1);
});

test("parses variants in bullets, slashes and tables", () => {
  const b = parseGlossaryMarkdown("- **Aarti** (also: Arti, Arthi) – Ritual of light\n- **Pooja / Puja** – Worship");
  assert.deepEqual(b.rows[0].variants, ["Arti", "Arthi"]);
  assert.equal(b.rows[0].definition, "Ritual of light");
  assert.deepEqual(b.rows[1], { term: "Pooja", variants: ["Puja"], definition: "Worship", line: 2 });
  const t = parseGlossaryMarkdown("| Word | Also written as | Meaning |\n|---|---|---|\n| Seva | Sewa, Saiva | Service |");
  assert.deepEqual(t.rows.map((r) => [r.term, r.variants, r.definition]), [["Seva", ["Sewa", "Saiva"], "Service"]]);
});

test("falls back to headings", () => {
  const { rows } = parseGlossaryMarkdown("# Glossary\n\n## Seva\nService to others.\n\n## Sevak\nA person doing seva.");
  assert.deepEqual(rows.map((r) => [r.term, r.definition]), [["Seva", "Service to others."], ["Sevak", "A person doing seva."]]);
});
