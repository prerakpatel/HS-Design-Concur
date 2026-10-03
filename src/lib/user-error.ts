/**
 * Errors meant for the person using the app. In production Next.js hides the message of anything thrown inside a
 * Server Action and forwards only its `digest`, so the message rides in the digest and errorMessage() reads it back.
 */
const PREFIX = "DC_USER:";

export class UserError extends Error {
  digest: string;
  constructor(message: string) { super(message); this.name = "UserError"; this.digest = PREFIX + message; }
}

/** What to show in a toast for an error caught on the client. */
export function errorMessage(e: unknown): string {
  const err = e as { digest?: string; message?: string } | null;
  if (err?.digest?.startsWith(PREFIX)) return err.digest.slice(PREFIX.length);
  const m = err?.message ?? "";
  if (m === "NEXT_REDIRECT") return "Your session ended. Please sign in again.";
  if (!m || /Minified React error|Server Components render/.test(m)) return "Something went wrong. Please try again.";
  return m;
}
