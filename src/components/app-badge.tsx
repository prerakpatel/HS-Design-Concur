"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type BadgingNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/**
 * Keeps the home-screen icon badge (iOS 16.4+ installed web apps, Android, desktop PWAs) equal to the number of
 * unread notifications. Push messages also set it while the app is closed (see public/sw.js); this corrects it
 * whenever the app is opened, regains focus or moves between pages.
 */
export function AppBadge() {
  const pathname = usePathname();
  useEffect(() => {
    const nav = navigator as BadgingNavigator;
    if (!nav.setAppBadge) return;
    let alive = true;
    const sync = async () => {
      try {
        const r = await fetch("/api/unread", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const { count } = (await r.json()) as { count: number };
        if (count > 0) await nav.setAppBadge?.(count); else await nav.clearAppBadge?.();
      } catch { /* badges are a nicety; never get in the way */ }
    };
    void sync();
    // Opening the Inbox marks everything read just after it renders; check again once that has happened.
    const later = pathname.startsWith("/inbox") ? setTimeout(sync, 2500) : null;
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; if (later) clearTimeout(later); document.removeEventListener("visibilitychange", onVisible); };
  }, [pathname]);
  return null;
}
