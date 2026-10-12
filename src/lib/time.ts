import { APP_TIMEZONE } from "@/config/orgs";

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

/** A moment as a YYYY-MM-DD day in the app's own time zone (not the server's, which is UTC and a day ahead on a US evening). */
export const isoDay = (when: Date | number, tz: string = APP_TIMEZONE) => new Date(when).toLocaleDateString("en-CA", { timeZone: tz });
export const todayIso = (tz?: string) => isoDay(Date.now(), tz);
export const daysFromNowIso = (days: number, tz?: string) => isoDay(Date.now() + days * DAY_MS, tz);
