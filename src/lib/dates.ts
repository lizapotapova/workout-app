/** A day as text, e.g. "2026-11-13", in the phone's own time zone. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Turns "2026-11-13" back into a Date (at midnight). Returns null if the text isn't a real day. */
export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dayKey(date) === key ? date : null;
}

/** The day a number of days after the given day, e.g. addDays("2026-11-13", 14) is "2026-11-27". */
export function addDays(key: string, days: number): string {
  const date = parseDayKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/**
 * The date and time to store on something logged for `day`. For today that's right now.
 * For another day it's that day with the current clock time, so things added one after
 * another stay in the order they were entered.
 */
export function timeOnDay(day: string): Date {
  const now = new Date();
  const date = day !== dayKey(now) ? parseDayKey(day) : null;
  if (!date) return now;
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return date;
}
