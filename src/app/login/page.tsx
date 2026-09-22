import { createClient } from "@/lib/supabase/server";
import { OrgMark } from "@/components/org-mark";
import { GoogleButton } from "./google-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const supabase = await createClient();
  const { data: orgs } = await supabase.from("org_branding").select("id,name,short_name,logo_path").order("name");
  return (
    <main className="min-h-dvh bg-card">
      <div className="h-48 w-full bg-[#F6F0DC] md:h-[300px]">
        <img src="/brand/design-concur-hero.webp" alt="" className="size-full object-cover object-center" />
      </div>
      <div className="mx-auto w-full max-w-[440px] px-6 py-10 md:py-14">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Design &amp; Concur</p>
        <h1 className="mt-2 text-[26px] font-semibold leading-8 tracking-[-0.02em]">Event assets, briefed, designed and approved in one place.</h1>
        {(orgs ?? []).length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {(orgs ?? []).map((o) => <li key={o.id} className="flex items-center gap-2.5"><OrgMark org={o} size={32} /><span className="text-sm font-medium">{o.name}</span></li>)}
          </ul>
        )}
        <div className="mt-8"><GoogleButton next={next} /></div>
        {error && <p className="mt-3 text-sm text-destructive-text">Sign-in did not complete. Try again.</p>}
        <p className="mt-6 text-sm leading-6 text-muted-foreground">Access is by invitation. After you sign in with Google, a Core Admin approves your request and picks your organisation.</p>
      </div>
    </main>
  );
}
