// Generates concrete dose occurrences from a regimen over a date window.
//
// This is the highest-risk logic in the codebase (see CLAUDE.md §10) because
// the scheduler downstream treats its output as ground truth: every row here
// becomes one notification. A pure function, deliberately hand-rolled instead
// of using `rrule` — see CLAUDE.md §4, "Explicitly rejected".

import type { LocalTime, Regimen, RuleConfig, Weekday } from "./regimen";

export interface GeneratedOccurrence {
  regimenId: string;
  /** UTC epoch milliseconds — the instant the dose is due. */
  scheduledAt: number;
}

/**
 * Generate occurrences for `regimen` on local calendar days in
 * [windowStart, windowEnd], inclusive, clipped to the regimen's own
 * start/end date and active flag.
 *
 * windowStart/windowEnd are local calendar dates (YYYY-MM-DD). Occurrences
 * outside the regimen's active date range are never produced, even if they
 * fall inside the window.
 */
export function generateOccurrences(
  regimen: Regimen,
  windowStart: string,
  windowEnd: string,
): GeneratedOccurrence[] {
  if (!regimen.active) return [];

  const rangeStart = maxDate(windowStart, regimen.startDate);
  const rangeEnd = regimen.endDate ? minDate(windowEnd, regimen.endDate) : windowEnd;
  if (rangeStart > rangeEnd) return [];

  const occurrences: GeneratedOccurrence[] = [];
  for (const day of eachLocalDate(rangeStart, rangeEnd)) {
    const times = timesForDay(regimen.rule, day, regimen.startDate);
    for (const time of times) {
      occurrences.push({
        regimenId: regimen.id,
        scheduledAt: localDateTimeToUtcMs(day, time),
      });
    }
  }
  return occurrences;
}

function timesForDay(rule: RuleConfig, day: string, regimenStartDate: string): LocalTime[] {
  switch (rule.type) {
    case "fixed_daily":
      return rule.times;

    case "specific_weekdays":
      return rule.weekdays.includes(weekdayOf(day)) ? rule.times : [];

    case "every_n_days": {
      const daysSinceStart = daysBetween(regimenStartDate, day);
      return daysSinceStart >= 0 && daysSinceStart % rule.intervalDays === 0 ? rule.times : [];
    }
  }
}

// --- Local-date arithmetic ---------------------------------------------
//
// Dates are plain YYYY-MM-DD strings, deliberately not `Date` objects, to
// keep "local calendar day" unambiguous and avoid accidental UTC/local
// conversion bugs while iterating. The only place a `Date` is constructed
// is the final UTC-ms conversion, and that construction is explicit about
// which fields are local.

function weekdayOf(day: string): Weekday {
  const [y, m, d] = parseDate(day);
  // Noon avoids any DST-adjacent ambiguity when resolving a weekday from a
  // local date; see CLAUDE.md's time zone section — not a factor in the
  // Philippines, but this keeps the helper itself correct if ever reused.
  return new Date(y, m - 1, d, 12).getDay() as Weekday;
}

function daysBetween(fromDay: string, toDay: string): number {
  const [fy, fm, fd] = parseDate(fromDay);
  const [ty, tm, td] = parseDate(toDay);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

function* eachLocalDate(start: string, end: string): Generator<string> {
  const [y, m, d] = parseDate(start);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  const endMs = Date.UTC(
    ...(parseDate(end).map((n, i) => (i === 1 ? n - 1 : n)) as [number, number, number]),
  );
  while (cursor.getTime() <= endMs) {
    yield formatDate(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

function localDateTimeToUtcMs(day: string, time: LocalTime): number {
  const [y, m, d] = parseDate(day);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function parseDate(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}
