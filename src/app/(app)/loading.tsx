/** Instant structure while a page's data loads (the sidebar stays put). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div className="space-y-2.5"><div className="h-7 w-44 rounded-lg bg-muted" /><div className="h-4 w-72 rounded bg-muted" /></div>
        <div className="h-10 w-28 rounded-lg bg-muted" />
      </div>
      <div className="mb-6 flex gap-6 border-b border-border pb-3">{[0, 1, 2].map((i) => <div key={i} className="h-4 w-20 rounded bg-muted" />)}</div>
      <div className="divide-y divide-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 py-3.5">
            <div className="size-12 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-muted" /><div className="h-3 w-1/2 rounded bg-muted" /></div>
            <div className="hidden h-6 w-24 rounded-full bg-muted md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
