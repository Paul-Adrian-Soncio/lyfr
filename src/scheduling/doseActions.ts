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
import { eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { db } from "@/db/client";
import { doseEdits, doseOccurrences } from "@/db/schema";
import type { EffectiveStatus } from "@/domain/doseStatus";
import { scheduleOccurrenceNotification } from "./AndroidScheduler";

export async function markTaken(occurrenceId: string): Promise<void> {
  await db
    .update(doseOccurrences)
    .set({ status: "taken", acknowledgedAt: Date.now() })
    .where(eq(doseOccurrences.id, occurrenceId));
}

export async function markSkipped(occurrenceId: string): Promise<void> {
  await db
    .update(doseOccurrences)
    .set({ status: "skipped", acknowledgedAt: Date.now() })
    .where(eq(doseOccurrences.id, occurrenceId));
}

// Snooze re-times this occurrence rather than changing its status — the
// dose is still upcoming, just later. Re-schedules the underlying
// notification too, so the delay is real, not just a UI label.
const SNOOZE_MINUTES = 10;

export async function snooze(occurrenceId: string): Promise<void> {
  const row = await db.query.doseOccurrences.findFirst({
    where: eq(doseOccurrences.id, occurrenceId),
    with: { regimen: { with: { medication: true } } },
  });
  if (!row) return;

  const newTime = Date.now() + SNOOZE_MINUTES * 60_000;

  await db
    .update(doseOccurrences)
    .set({ scheduledAt: newTime })
    .where(eq(doseOccurrences.id, occurrenceId));

  if (row.actualNotificationId) {
    await notifee.cancelTriggerNotification(row.actualNotificationId);
  }
  await scheduleOccurrenceNotification(row.id, row.regimen.medication.name, newTime);
}

/**
 * Corrects a past dose's status. `previous` is the status the person saw
 * (the effective one), not the raw stored value — an untouched dose past
 * its grace period is stored as "upcoming" but was shown and corrected as
 * "missed", and the audit trail should say so.
 */
export function correctDose(occurrenceId: string, previous: EffectiveStatus, next: EffectiveStatus): void {
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
