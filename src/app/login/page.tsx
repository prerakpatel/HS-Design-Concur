import { GoogleButton } from "./google-button";

export const metadata = { title: "Sign in" };

/**
 * Sign in. Desktop: the illustration fills the left, a quiet white panel holds the stacked logo, one line and the
 * Google button on the right. Phones: illustration on top, panel slides up over it. Nothing else to read: who it is
 * for, and one button. The "awaiting" page explains the approval step to anyone new.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col bg-card md:flex-row">
      <div className="relative h-[42dvh] shrink-0 bg-[#F6F0DC] md:h-auto md:min-h-dvh md:flex-1">
        <img src="/brand/design-concur-hero.webp" alt="" className="absolute inset-0 size-full object-cover object-center" />
      </div>
      <section className="relative -mt-6 flex flex-1 flex-col rounded-t-3xl bg-card px-7 pb-[max(env(safe-area-inset-bottom),28px)] pt-6 md:mt-0 md:w-[440px] md:flex-none md:rounded-none md:px-14 md:pt-8 md:pb-10 lg:w-[520px] lg:px-20">
        {/* Family mark: tiny, pinned to the top, out of the way */}
        <img src="/brand/harisumiran.svg" alt="Harisumiran" className="mx-auto h-7 w-auto opacity-90 md:h-8" />
        <div className="mx-auto flex w-full max-w-[340px] flex-1 flex-col justify-center py-8">
          <img src="/brand/logo-stacked.png" alt="Design & Concur" width={828} height={897} className="mx-auto h-auto w-[210px] md:w-[240px]" />
          <p className="mt-6 text-center text-[15px] leading-6 text-muted-foreground">For Harisumiran and Atmiya Care Charities design seva.</p>
          <div className="mt-8"><GoogleButton next={next} /></div>
          {error && <p className="mt-3 text-center text-sm text-destructive-text">Sign-in did not complete. Try again.</p>}
        </div>
      </section>
    </main>
  );
}
