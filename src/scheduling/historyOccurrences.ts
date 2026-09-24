// Query for the History tab's week view. Deliberately does NOT filter out
// archived medications — adherence history depends on them still showing
// (CLAUDE.md "Always true": medications are archived, never hard deleted).

import { and, asc, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { doseOccurrences } from "@/db/schema";

export const HISTORY_DAYS = 7;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The 7 calendar days ending on (and including) `lastDay`, oldest first. */
export function weekDays(lastDay: Date): Date[] {
  const end = startOfDay(lastDay);
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (HISTORY_DAYS - 1 - i));
    return d;
  });
}

/** Pass to useLiveQuery — do not await this directly. */
export function weekOccurrencesQuery(lastDay: Date) {
  const days = weekDays(lastDay);
  const from = days[0].getTime();
  const to = new Date(days[HISTORY_DAYS - 1]);
  to.setDate(to.getDate() + 1);

  return db.query.doseOccurrences.findMany({
    where: and(
      gte(doseOccurrences.scheduledAt, from),
      lt(doseOccurrences.scheduledAt, to.getTime()),
      ne(doseOccurrences.status, "cancelled")
    ),
    orderBy: asc(doseOccurrences.scheduledAt),
    with: { regimen: { with: { medication: true } } },
  });
}

export type HistoryOccurrenceRow = Awaited<ReturnType<typeof weekOccurrencesQuery>>[number];

export function isSameDay(ms: number, day: Date): boolean {
  const d = new Date(ms);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}
