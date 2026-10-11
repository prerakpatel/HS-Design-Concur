/**
 * Shown while a page's data loads: a small frosted card in the middle of the screen with three dots bobbing in
 * turn. It fades in after a beat (see .page-loader in globals.css), so quick navigations never flash it.
 */
export function PageLoader() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      <div className="page-loader flex items-center gap-2 rounded-3xl border border-white/60 bg-white/55 px-7 py-5 shadow-[0_18px_50px_-12px_rgba(20,30,60,0.3)] backdrop-blur-2xl">
        {[0, 1, 2].map((i) => <span key={i} className="loader-dot size-2.5 rounded-full bg-brand" style={{ animationDelay: `${i * 0.16}s` }} />)}
      </div>
    </div>
  );
}
