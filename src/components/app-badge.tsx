"use client";
import { useEffect } from "react";
import { useUnreadCount } from "@/components/unread-count";

type BadgingNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/**
 * Keeps the home-screen icon badge (iOS 16.4+ installed web apps, Android, desktop PWAs) equal to the number of
 * unread notifications. Push messages also set it while the app is closed (see public/sw.js); this corrects it
 * whenever the app is opened, regains focus or moves between pages.
 */
export function AppBadge() {
  const count = useUnreadCount();
  useEffect(() => {
    const nav = navigator as BadgingNavigator;
    if (!nav.setAppBadge) return;
    void (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.()).catch(() => {});
  }, [count]);
  return null;
}
