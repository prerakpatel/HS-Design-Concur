const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Is "@token" typed in this text as a whole word? "@bob" matches in "thanks @bob!" but not in "bob@gmail.com" (the
 * @ belongs to an address) and "@g" does not match "@gmail" (it is not the end of the name).
 */
export function mentionsToken(text: string, token: string): boolean {
  if (!token) return false;
  return new RegExp(`(^|[^a-z0-9._-])@${escape(token.toLowerCase())}(?![a-z0-9._-])`).test(text.toLowerCase());
}
