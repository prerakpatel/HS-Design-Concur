import { GoogleButton } from "./google-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-subtle p-6">
      <div className="w-full max-w-[440px] rounded-3xl border border-border bg-card px-8 py-12 text-center md:px-12">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand text-sm font-medium text-brand-foreground">D&amp;C</div>
        <h1 className="mt-7 text-[32px] font-semibold leading-10 tracking-[-0.02em]">Design &amp; Concur</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Event assets for Harisumiran and Atmiya Care Charities</p>
        <div className="mt-8"><GoogleButton next={next} /></div>
        {error && <p className="mt-3 text-xs text-destructive-text">Sign-in did not complete. Try again.</p>}
        <p className="mt-8 text-sm leading-5 text-muted-foreground">Access is by invitation. After you sign in, a Core Admin approves your request.</p>
      </div>
    </main>
  );
}
