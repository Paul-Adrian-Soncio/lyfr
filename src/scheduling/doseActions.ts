// Taken / Snooze / Skip actions from the Today view. See CLAUDE.md §6:
// "Actions: Taken, Snooze, Skip — handled without opening the app" (that
// requirement is about the lock-screen notification's own action buttons,
// not built yet — see STATE.md; this module is the in-app equivalent,
// which the notification action handler should eventually call into too,
// so the two paths don't diverge).
//
// This only covers the FIRST action taken on an occurrence. Correcting an
// already-set status afterward is a dose_edits concern — see CLAUDE.md §5,
// "dose_edits is an audit trail" — and belongs to the History screen, not
// built yet.

import notifee from "@notifee/react-native";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { doseOccurrences } from "@/db/schema";
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
