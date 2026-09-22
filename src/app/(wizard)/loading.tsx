/** Wizard skeleton: step rail, header row, centred title and a few fields. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex min-h-dvh animate-pulse flex-col bg-card md:flex-row">
      <aside className="hidden w-[220px] shrink-0 border-r border-border bg-subtle p-5 md:block">
        <div className="mx-3 h-3 w-16 rounded bg-muted" />
        <div className="mt-4 space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/70" />)}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-4 md:px-8"><div className="size-8 rounded-full bg-muted" /><div className="h-4 w-32 rounded bg-muted" /><div className="h-10 w-28 rounded-lg bg-muted" /></div>
        <div className="mx-auto w-full max-w-[640px] px-5 pt-6 md:px-8 md:pt-10">
          <div className="mx-auto h-8 w-2/3 rounded-lg bg-muted" />
          <div className="mx-auto mt-3 h-4 w-1/2 rounded bg-muted" />
          <div className="mt-10 space-y-6">{[0, 1, 2].map((i) => <div key={i} className="space-y-2"><div className="h-4 w-24 rounded bg-muted" /><div className="h-11 rounded-lg bg-muted" /></div>)}</div>
        </div>
      </div>
    </div>
  );
}
