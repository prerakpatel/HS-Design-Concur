import { SectionHeader } from "@/components/page-header";
import { Icon } from "@/components/material-icon";
import { PURGE_AFTER_DAYS } from "@/config/limits";

/**
 * An archived event keeps one compressed reference of its primary design (PRD §8). The format
 * files are gone, so instead of a grid of empty tiles the page shows that one image, fitted whole.
 */
export function ArchivedReference({ src, formatName, approved, requested }: { src: string | null; formatName: string | null; approved: number; requested: number }) {
  return (
    <section>
      <SectionHeader title="Reference" meta={`${approved} of ${requested} formats approved`} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-center bg-canvas p-5 md:p-8">
          {src
            ? <img src={src} alt={formatName ? `${formatName}, reference copy` : "Reference copy"} className="max-h-[min(60vh,560px)] max-w-full rounded-[3px] object-contain shadow-[0_1px_3px_rgba(0,0,0,.12),0_8px_20px_-8px_rgba(0,0,0,.22)]" />
            : <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Icon name="inventory_2" size={24} />No reference was kept for this event.</div>}
        </div>
        <p className="flex items-start gap-2 p-4 text-sm text-muted-foreground"><Icon name="inventory_2" className="mt-px !text-[18px]" /><span>{formatName ? `${formatName} · ` : ""}a compressed copy kept for reference. The format files were cleared {PURGE_AFTER_DAYS} days after the event; the brief, decisions and comments stay.</span></p>
      </div>
    </section>
  );
}
