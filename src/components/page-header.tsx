import Link from "next/link";
import { Icon } from "@/components/material-icon";

/** A back link that reads as a control, not a breadcrumb. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-card pl-2 pr-3.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted"><Icon name="arrow_back" className="!text-[18px]" /><span className="truncate">{label}</span></Link>;
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-2.5">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] md:text-[26px] md:leading-9">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({ title, meta, action }: { title: string; meta?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      {/* Title and meta stay together; on narrow screens the meta drops under the title and the actions wrap to their own row. */}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5"><h2 className="text-lg font-semibold leading-7 tracking-[-0.01em]">{title}</h2>{meta && <span className="text-sm text-muted-foreground">{meta}</span>}</div>
      {action && <div className="ml-auto flex shrink-0 items-center">{action}</div>}
    </div>
  );
}
