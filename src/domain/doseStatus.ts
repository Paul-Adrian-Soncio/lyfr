// What a dose occurrence effectively is right now. Stored status only
// changes when someone acts, so an untouched dose stays "upcoming" in the
// database forever; "missed" is derived here instead, at read time, per
// CLAUDE.md §3's rule that working out what was missed is a pure function
// over stored occurrences.

export type StoredStatus = "upcoming" | "taken" | "skipped" | "missed" | "cancelled";
export type EffectiveStatus = "upcoming" | "taken" | "skipped" | "missed";

// Chosen by the developer 2026-09-24. Long enough that a dose taken a bit
// late isn't flagged, short enough that History is right the same day.
export const MISSED_GRACE_MS = 2 * 60 * 60 * 1000;

export function effectiveStatus(
  occurrence: { status: string; scheduledAt: number },
  now: number
): EffectiveStatus {
  switch (occurrence.status) {
    case "taken":
    case "skipped":
    case "missed":
      return occurrence.status;
    default:
      return now > occurrence.scheduledAt + MISSED_GRACE_MS ? "missed" : "upcoming";
  }
}

export interface DaySummary {
  total: number;
  taken: number;
  /** The one status that best describes the day, or null if nothing was scheduled. */
  overall: EffectiveStatus | null;
}

// A day with any miss reads as missed; otherwise any dose still to come
// reads as upcoming; otherwise the day is done.
export function summarizeDay(statuses: EffectiveStatus[]): DaySummary {
  const taken = statuses.filter((s) => s === "taken").length;
  let overall: EffectiveStatus | null = null;
  if (statuses.includes("missed")) overall = "missed";
  else if (statuses.includes("upcoming")) overall = "upcoming";
  else if (statuses.length > 0) overall = "taken";
  return { total: statuses.length, taken, overall };
}

/** Statuses a past dose can be corrected to, excluding the one it already has. */
export function correctionOptions(current: EffectiveStatus): EffectiveStatus[] {
  return (["taken", "skipped", "missed"] as const).filter((s) => s !== current);
}
