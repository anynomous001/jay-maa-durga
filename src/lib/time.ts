/**
 * Time helpers. Every instant in config carries a +05:30 offset, so
 * `new Date(iso)` is the same moment for every visitor. Display uses Intl with
 * an explicit timeZone, which keeps IST correct even for diaspora users.
 */
import type { Lang } from './i18n';

export const IST = 'Asia/Kolkata';

/** Test hook: `?now=2026-10-10T03:59:50%2B05:30` shifts the clock (display + wake). */
const offsetMs = (() => {
  const raw = new URLSearchParams(location.search).get('now');
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t - Date.now();
})();

export const now = (): number => Date.now() + offsetMs;
export const at = (iso: string): number => Date.parse(iso);

export const localTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const locale = (lang: Lang) => (lang === 'bn' ? 'bn-IN' : 'en-IN');

/** YYYY-MM-DD of the given instant on the IST calendar. */
export function istDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);
}

/** Whole days from IST date `a` to IST date `b` (both YYYY-MM-DD). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
}

export function formatTime(ms: number, lang: Lang, timeZone: string): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(ms);
}

export function formatDate(ms: number, lang: Lang, timeZone: string, withWeekday = true): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone,
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
  }).format(ms);
}

/** Short zone label for the visitor, e.g. "GMT+1" / "EDT". */
export function zoneName(ms: number, timeZone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(ms)
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? timeZone;
}

/** Date-only IST key like "2026-10-16" → instant at IST noon (safe for formatting). */
export const istNoon = (key: string): number => Date.parse(`${key}T12:00:00+05:30`);

export interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}
export function splitDuration(ms: number): Parts {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}
