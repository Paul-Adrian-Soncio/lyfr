// Taken / Snooze / Skip actions from the Today view. See CLAUDE.md §6:
// "Actions: Taken, Snooze, Skip — handled without opening the app" (that
// requirement is about the lock-screen notification's own action buttons,
// not built yet — see STATE.md; this module is the in-app equivalent,
// which the notification action handler should eventually call into too,
// so the two paths don't diverge).
//
// markTaken/markSkipped/snooze are the FIRST action on an occurrence.
// Changing a status after the fact goes through correctDose, which keeps
// the previous value in dose_edits — CLAUDE.md "Always true": edits are
// appended, never destructive.

import notifee from "@notifee/react-native";
import { eq, sql } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { db } from "@/db/client";
import { doseEdits, doseOccurrences } from "@/db/schema";
import type { EffectiveStatus } from "@/domain/doseStatus";
import { scheduleOccurrenceNotification } from "./AndroidScheduler";

// Both also cancel the dose's reminder — the notification id is the
// occurrence id. Otherwise a dose marked taken early still fires later
// asking to be taken, and one acted on from the shade stays in the shade.
export async function markTaken(occurrenceId: string): Promise<void> {
  await db
    .update(doseOccurrences)
    .set({ status: "taken", acknowledgedAt: Date.now() })
    .where(eq(doseOccurrences.id, occurrenceId));
  await notifee.cancelNotification(occurrenceId);
}

export async function markSkipped(occurrenceId: string): Promise<void> {
  await db
    .update(doseOccurrences)
    .set({ status: "skipped", acknowledgedAt: Date.now() })
    .where(eq(doseOccurrences.id, occurrenceId));
  await notifee.cancelNotification(occurrenceId);
}

// Snooze re-fires the reminder later without touching scheduledAt. The
// scheduled time is the dose's identity: refills match slots by it, and
// History shows it. Moving it left the original slot looking empty, so a
// refill would book the dose twice (found 2026-09-25).
const SNOOZE_MINUTES = 10;

export async function snooze(occurrenceId: string): Promise<void> {
  const row = await db.query.doseOccurrences.findFirst({
    where: eq(doseOccurrences.id, occurrenceId),
    with: { regimen: { with: { medication: true } } },
  });
  if (!row) return;

  // From whichever is later, so snoozing a dose that isn't due yet delays
  // it rather than pulling it forward.
  const now = Date.now();
  const refireAt = Math.max(now, row.scheduledAt) + SNOOZE_MINUTES * 60_000;

  await db
    .update(doseOccurrences)
    .set({ snoozeCount: sql`${doseOccurrences.snoozeCount} + 1`, lastSnoozedAt: now })
    .where(eq(doseOccurrences.id, occurrenceId));

  await notifee.cancelNotification(row.id);
  await scheduleOccurrenceNotification(row.id, row.regimen.medication.name, refireAt);
}

/**
 * Corrects a past dose's status. `previous` is the status the person saw
 * (the effective one), not the raw stored value — an untouched dose past
 * its grace period is stored as "upcoming" but was shown and corrected as
 * "missed", and the audit trail should say so.
 */
export function correctDose(
  occurrenceId: string,
  previous: EffectiveStatus,
  next: EffectiveStatus,
): void {
  const now = Date.now();
  db.transaction((tx) => {
    tx.insert(doseEdits)
      .values({
        id: Crypto.randomUUID(),
        occurrenceId,
        previousStatus: previous,
        newStatus: next,
        editedAt: now,
      })
      .run();
    tx.update(doseOccurrences)
      .set({ status: next, acknowledgedAt: next === "missed" ? null : now })
      .where(eq(doseOccurrences.id, occurrenceId))
      .run();
  });
}
