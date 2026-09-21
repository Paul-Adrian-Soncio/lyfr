// The heartbeat: verifies the OS actually honoured scheduled alarms, rather
// than assuming it did. See CLAUDE.md §3 — "the single most important
// subsystem in the app."
//
// Two independent signals feed this, deliberately not just one:
//   1. Notifee's DELIVERED event (best-effort, fast) — logged as soon as a
//      notification is actually shown, from the background event handler.
//   2. Launch-time reconciliation (authoritative, slow) — a pure comparison
//      over stored rows. This is what catches the case the event handler
//      itself cannot: the OS killed the alarm outright, so no event ever
//      fired at all. Per CLAUDE.md §3, reconciliation happens on app
//      launch, not at fire time, because "what was missed while the app was
//      closed" cannot depend on code that only runs while the app is open.

import { and, eq, isNull, lt } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { db } from "@/db/client";
import { notificationLog } from "@/db/schema";

/**
 * Call when AndroidScheduler schedules a notification for an occurrence.
 * Records what we expect to happen, so launch-time reconciliation has
 * something to compare against.
 */
export async function logExpectedFire(
  occurrenceId: string,
  expectedFireAt: number,
  channel: string
): Promise<void> {
  await db.insert(notificationLog).values({
    id: Crypto.randomUUID(),
    occurrenceId,
    expectedFireAt,
    channel,
    platform: "android",
  });
}

export interface ReconcileResult {
  /** Occurrences scheduled in the past with no observed fire recorded. */
  suspectedMisses: { occurrenceId: string; expectedFireAt: number }[];
  /** Occurrences confirmed delivered, one way or another. */
  confirmed: number;
}

/**
 * Pure-ish comparison of expected vs. observed fires for occurrences whose
 * scheduled time has already passed. Call on every app launch.
 *
 * Deliberately does not distinguish "OS killed the alarm" from "delivered
 * but the DELIVERED event handler didn't run" (e.g. before the app was
 * ever opened once to register it) — from the log alone those look
 * identical, and both are exactly the situation CLAUDE.md's missed-fire
 * banner exists for.
 */
export async function reconcile(now: number = Date.now()): Promise<ReconcileResult> {
  const pastDue = await db
    .select()
    .from(notificationLog)
    .where(and(lt(notificationLog.expectedFireAt, now), isNull(notificationLog.observedFireAt)));

  const suspectedMisses = pastDue.map((row) => ({
    occurrenceId: row.occurrenceId,
    expectedFireAt: row.expectedFireAt,
  }));

  const confirmedRows = await db
    .select()
    .from(notificationLog)
    .where(and(lt(notificationLog.expectedFireAt, now)));

  return {
    suspectedMisses,
    confirmed: confirmedRows.length - suspectedMisses.length,
  };
}

/**
 * Call from the Notifee background/foreground event handler on a DELIVERED
 * event. Best-effort — see module doc for why this can't be the only signal.
 */
export async function logObservedFire(
  occurrenceId: string,
  observedFireAt: number = Date.now()
): Promise<void> {
  await db
    .update(notificationLog)
    .set({ observedFireAt })
    .where(
      and(eq(notificationLog.occurrenceId, occurrenceId), isNull(notificationLog.observedFireAt))
    );
}
