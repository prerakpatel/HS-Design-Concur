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
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex items-baseline gap-3"><h2 className="text-lg font-semibold leading-7 tracking-[-0.01em]">{title}</h2>{meta && <span className="text-sm text-muted-foreground">{meta}</span>}</div>
      {action}
    </div>
  );
}
