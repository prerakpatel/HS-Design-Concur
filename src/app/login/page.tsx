import { GoogleButton } from "./google-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-subtle p-6">
      <div className="w-full max-w-[420px] rounded-3xl border border-border bg-card p-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-brand text-xs font-medium text-brand-foreground">D&amp;C</div>
        <h1 className="mt-6 text-[30px] font-semibold leading-9 tracking-[-0.015em]">Design &amp; Concur</h1>
        <p className="mt-2 text-sm text-muted-foreground">Event assets for Harisumiran and Atmiya Care Charities</p>
        <div className="mt-6"><GoogleButton next={next} /></div>
        {error && <p className="mt-3 text-xs text-destructive-text">Sign-in did not complete. Try again.</p>}
        <p className="mt-6 text-xs text-muted-foreground">Access is by invitation. After you sign in, a Core Admin approves your request.</p>
      </div>
    </main>
  );
}
