import { GoogleButton } from "./google-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-[#F6F0DC] p-5">
      <img src="/brand/design-concur-hero.webp" alt="" className="pointer-events-none absolute inset-0 size-full object-cover object-center" />
      <div className="relative w-full max-w-[440px] rounded-3xl border border-white/60 bg-card/95 px-7 py-9 shadow-2xl backdrop-blur md:px-9 md:py-10">
        <img src="/brand/logo-full.png" alt="Design & Concur by Harisumiran" width={1871} height={403} className="h-12 w-auto" />
        <h1 className="mt-6 text-[26px] font-semibold leading-8 tracking-[-0.02em]">Event assets, briefed, designed and approved in one place.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">For Harisumiran and Atmiya Care Charities.</p>
        <div className="mt-8"><GoogleButton next={next} /></div>
        {error && <p className="mt-3 text-sm text-destructive-text">Sign-in did not complete. Try again.</p>}
        <p className="mt-6 text-sm leading-6 text-muted-foreground">Access is by invitation. After you sign in with Google, a Core Admin approves your request and picks your organisation.</p>
      </div>
    </main>
  );
}
