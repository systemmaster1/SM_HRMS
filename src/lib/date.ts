/**
 * India-safe date helpers.
 *
 * `new Date().toISOString().slice(0, 10)` returns the UTC date, which is
 * YESTERDAY between 12:00 AM and 5:30 AM IST, and it also shifts local-midnight
 * dates (e.g. "1st of this month") back by one day. Always use these instead.
 * They work the same on the browser and on the Vercel server (which runs in UTC).
 */
export const APP_TZ = "Asia/Kolkata";

/** Any Date -> "YYYY-MM-DD" as seen on an Indian calendar. */
export function ymd(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

/** Today's date in IST as "YYYY-MM-DD". */
export const todayYMD = () => ymd(new Date());

/** "YYYY-MM-DD" shifted by n days (calendar arithmetic, no timezone drift). */
export function addDaysYMD(base: string, n: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** First and last day of a month, offset from the current IST month. */
export function monthRangeYMD(offset = 0): { from: string; to: string } {
  const [y, m] = todayYMD().split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

/** A due date + optional "HH:MM[:SS]" time interpreted as IST -> Date. */
export function istDateTime(date: string, time?: string | null, fallback = "23:59"): Date {
  let t = (time || fallback).trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) t = `${t.padStart(5, "0")}:00`;
  return new Date(`${date}T${t.slice(0, 8)}+05:30`);
}

/** Timestamp -> "23 Sep 2026, 09:05 am" in IST ("" for empty). */
export function fmtStampIST(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: APP_TZ, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}
