// Android implementation of the Scheduler contract, backed by Notifee.
// See CLAUDE.md §3/§4 and STATE.md's "To verify, not assume" for the Doze
// reliability findings this design relies on:
//   - AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE survives Doze on the test
//     tablet with the screen off and unplugged.
//   - Notification channel settings (sound, vibration, visibility) cannot be
//     changed after the channel is first created — Android silently ignores
//     updates. Bump REMINDER_CHANNEL_ID if these settings ever need to change.

import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  TriggerType,
} from "@notifee/react-native";
import { eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { db } from "@/db/client";
import { doseOccurrences, medications, regimens } from "@/db/schema";
import { generateOccurrences } from "@/domain/occurrenceGenerator";
import type { Regimen, RuleConfig } from "@/domain/regimen";
import { logExpectedFire } from "./heartbeat";
import type { Scheduler } from "./Scheduler";

const REMINDER_CHANNEL_ID = "dose-reminders-v1";

// How far ahead to keep occurrences scheduled. See CLAUDE.md §3 — this is
// unrelated to the iOS 64-pending-notification cap (Android has no such
// cap), but a week is still a sane refill horizon so a regimen edited today
// is reflected promptly rather than having a month of stale occurrences
// scheduled against the old rule.
const WINDOW_DAYS = 7;

// Thrown when the OS notification permission is denied. Without this,
// syncRegimen previously wrote dose_occurrences and called
// createTriggerNotification "successfully" while POST_NOTIFICATIONS was
// revoked — Notifee does not itself throw for this, and the OS silently
// drops the notification. Found on-device 2026-09-18/19; see STATE.md.
export class NotificationPermissionDeniedError extends Error {
  constructor() {
    super("Notification permission was denied — reminders will not be delivered.");
  }
}

async function ensurePermission(): Promise<void> {
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
    throw new NotificationPermissionDeniedError();
  }
}

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: REMINDER_CHANNEL_ID,
    name: "Dose reminders",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    visibility: AndroidVisibility.PUBLIC,
  });
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentWindow(): { windowStart: string; windowEnd: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + WINDOW_DAYS);
  return { windowStart: toLocalDateString(now), windowEnd: toLocalDateString(end) };
}

function toDomainRegimen(row: typeof regimens.$inferSelect): Regimen {
  return {
    id: row.id,
    medicationId: row.medicationId,
    rule: row.ruleConfig as RuleConfig,
    startDate: row.startDate,
    endDate: row.endDate,
    active: row.active,
  };
}

async function scheduleOccurrenceNotification(
  occurrenceId: string,
  medicationName: string,
  scheduledAt: number
): Promise<void> {
  await notifee.createTriggerNotification(
    {
      id: occurrenceId,
      title: medicationName,
      body: "Time to take this dose",
      android: {
        channelId: REMINDER_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        pressAction: { id: "default" },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: scheduledAt,
      alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
    }
  );
}

export const AndroidScheduler: Scheduler = {
  async syncRegimen(regimen: Regimen): Promise<void> {
    await ensurePermission();
    await ensureChannel();

    const medication = await db.query.medications.findFirst({
      where: eq(medications.id, regimen.medicationId),
    });
    if (!medication) {
      throw new Error(`syncRegimen: no medication found for id ${regimen.medicationId}`);
    }

    if (!regimen.active) {
      await this.cancelRegimen(regimen.id);
      return;
    }

    const { windowStart, windowEnd } = currentWindow();
    const generated = generateOccurrences(regimen, windowStart, windowEnd);

    const existing = await db.query.doseOccurrences.findMany({
      where: eq(doseOccurrences.regimenId, regimen.id),
    });
    const existingByTime = new Map(existing.map((row) => [row.scheduledAt, row]));

    for (const occurrence of generated) {
      const existingRow = existingByTime.get(occurrence.scheduledAt);
      if (existingRow) {
        // Already materialised (and, if still pending, already scheduled
        // with the OS under this row's id) — idempotent no-op.
        continue;
      }

      const [inserted] = await db
        .insert(doseOccurrences)
        .values({
          id: Crypto.randomUUID(),
          regimenId: regimen.id,
          scheduledAt: occurrence.scheduledAt,
          status: "upcoming",
        })
        .returning();

      await scheduleOccurrenceNotification(
        inserted.id,
        medication.name,
        inserted.scheduledAt
      );

      await db
        .update(doseOccurrences)
        .set({ actualNotificationId: inserted.id })
        .where(eq(doseOccurrences.id, inserted.id));

      await logExpectedFire(inserted.id, inserted.scheduledAt, REMINDER_CHANNEL_ID);
    }
  },

  async cancelRegimen(regimenId: string): Promise<void> {
    const rows = await db.query.doseOccurrences.findMany({
      where: eq(doseOccurrences.regimenId, regimenId),
    });
    const idsToCancel = rows
      .filter((row) => row.status === "upcoming" && row.actualNotificationId)
      .map((row) => row.actualNotificationId as string);

    if (idsToCancel.length > 0) {
      await notifee.cancelTriggerNotifications(idsToCancel);
    }
  },

  async refillWindow(): Promise<void> {
    const activeRegimens = await db.query.regimens.findMany({
      where: eq(regimens.active, true),
    });
    for (const row of activeRegimens) {
      await this.syncRegimen(toDomainRegimen(row));
    }
  },

  async pendingCount(): Promise<number> {
    const ids = await notifee.getTriggerNotificationIds();
    return ids.length;
  },
};
