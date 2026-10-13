"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const UnreadContext = createContext(0);

/** While someone clicks around, ask for the count at most this often (each ask is a trip to the database). */
const NAV_SYNC_MS = 60_000;

/** Unread notification count, kept fresh on focus and (at most once a minute) on navigation. Feeds the Inbox badges and the home-screen app badge. */
export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      last.current = Date.now();
      try {
        const r = await fetch("/api/unread", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const data = (await r.json()) as { count: number };
        if (alive) setCount(data.count);
      } catch { /* a badge is a nicety; never get in the way */ }
    };
    if (Date.now() - last.current > NAV_SYNC_MS) void sync();
    // Opening the Inbox marks everything read just after it renders; check again once that has happened.
    const later = pathname.startsWith("/inbox") ? setTimeout(sync, 2500) : null;
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; if (later) clearTimeout(later); document.removeEventListener("visibilitychange", onVisible); };
  }, [pathname]);
  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>;
}

export const useUnreadCount = () => useContext(UnreadContext);

/** Count bubble. Position it with `className` (absolute on mobile, in-flow on the sidebar). */
export function CountBubble({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span aria-label={`${count} unread`} className={"flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold leading-none text-brand-foreground tabular-nums " + (className ?? "")}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
