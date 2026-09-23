// Query helpers for the Today view. The mockup's Main screen is the app's
// home/landing surface — next dose, later-today list, daily progress.
//
// Split into a query builder (for useLiveQuery, which needs the
// un-awaited query object to know how to re-run itself on change events —
// see CLAUDE.md §4) and a pure mapping function, rather than one async
// function that awaits internally.

import { and, asc, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { doseOccurrences } from "@/db/schema";

export interface TodayOccurrence {
  id: string;
  scheduledAt: number;
  status: string;
  acknowledgedAt: number | null;
  medicationId: string;
  medicationName: string;
  photoPath: string | null;
  colorTag: string;
  form: string;
  doseAmount: string | null;
  doseUnit: string | null;
  description: string | null;
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Pass to useLiveQuery — do not await this directly. */
export function todayOccurrencesQuery(now: Date = new Date()) {
  return db.query.doseOccurrences.findMany({
    where: and(
      gte(doseOccurrences.scheduledAt, startOfDay(now)),
      lt(doseOccurrences.scheduledAt, endOfDay(now) + 1)
    ),
    orderBy: asc(doseOccurrences.scheduledAt),
    with: {
      regimen: {
        with: {
          medication: true,
        },
      },
    },
  });
}

type TodayOccurrenceRow = Awaited<ReturnType<typeof todayOccurrencesQuery>>[number];

/**
 * Excludes "cancelled" rows — those are dead per
 * AndroidScheduler.cancelRegimen, not part of today's real plan.
 */
export function mapTodayOccurrences(rows: TodayOccurrenceRow[]): TodayOccurrence[] {
  return rows
    .filter((row) => row.status !== "cancelled")
    .map((row) => ({
      id: row.id,
      scheduledAt: row.scheduledAt,
      status: row.status,
      acknowledgedAt: row.acknowledgedAt,
      medicationId: row.regimen.medication.id,
      medicationName: row.regimen.medication.name,
      photoPath: row.regimen.medication.photoPath,
      colorTag: row.regimen.medication.colorTag,
      form: row.regimen.medication.form,
      doseAmount: row.regimen.medication.doseAmount,
      doseUnit: row.regimen.medication.doseUnit,
      description: row.regimen.medication.description,
    }));
}
