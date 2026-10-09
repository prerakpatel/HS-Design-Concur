/**
 * Spelling keys for satsang words. One shared module so the server (on save and import) and the browser (on
 * search) always agree.
 *
 * termKey  — the word with case, spaces, hyphens and accents removed. Two spellings with the same termKey are
 *            the same spelling ("Das-na-das" = "dasnadas").
 * soundKey — a sound-alike key for Sanskrit/Gujarati words written in English letters. Spellings people use
 *            interchangeably end up with the same key: Aarti/Arti, Bhagwan/Bhagvan/Bhagwaan, Pooja/Puja,
 *            Gnaan/Gyan/Jnana, Satsang/Satsangh, Swaminarayan/Swaminarayana.
 *            Generic phonetic codes (Metaphone, Soundex) are tuned for English and do this badly.
 */

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function termKey(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function soundKey(s: string): string {
  let k = stripAccents(s).toLowerCase().replace(/[^a-z]/g, "");
  k = k
    .replace(/ksh/g, "ks")                 // shiksha → shiksa
    .replace(/chh?/g, "C")                 // chh / ch → one symbol, so it is not confused with c/k
    .replace(/sh/g, "s")
    .replace(/gn|jn|gy/g, "gn")            // gnaan / jnana / gyan
    .replace(/ph/g, "p")
    .replace(/([kgjtdb])h/g, "$1")         // aspirates: kh gh jh th dh bh
    .replace(/w/g, "v").replace(/z/g, "j").replace(/q/g, "k").replace(/x/g, "ks").replace(/c/g, "k")
    .replace(/ee+|ii+/g, "i").replace(/oo+|uu+/g, "u").replace(/aa+/g, "a")
    .replace(/([^aeiou])\1+/g, "$1")       // doubled consonants: chitt → cit
    .replace(/([aeiou])h$/, "$1")          // trailing h: Allah
    .replace(/^(.{3,})a$/, "$1");          // trailing a: Swaminarayana, Bhakta
  return k;
}

/** Edit distance, bailing out early once it exceeds `max`. */
export function distance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
