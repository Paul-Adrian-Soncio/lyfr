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

export const REMINDER_CHANNEL_ID = "dose-reminders-v1";

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

// Checks without prompting — for refills, which run on launch and in the
// background heartbeat task, where a permission dialog would be at best
// unexpected and at worst impossible to show.
async function hasPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus !== AuthorizationStatus.DENIED;
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

// Action ids, matched in notificationEvents.ts. CLAUDE.md §6: Taken, Snooze
// and Skip work from the notification without opening the app — actions
// with no launchActivity run in the background event handler instead.
export const NOTIFICATION_ACTION = {
  taken: "taken",
  snooze: "snooze",
  skip: "skip",
} as const;

// Exported for reuse by doseActions.ts's snooze — rescheduling a single
// occurrence outside a full syncRegimen pass needs the same notification
// shape, and duplicating it risks the two drifting apart.
export async function scheduleOccurrenceNotification(
  occurrenceId: string,
  medicationName: string,
  scheduledAt: number,
): Promise<void> {
  await notifee.createTriggerNotification(
    {
      id: occurrenceId,
      title: medicationName,
      body: "Time to take this dose",
      android: {
        channelId: REMINDER_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        // Tapping the body opens the app. Without launchActivity, Notifee
        // treats the press as background-only and nothing visible happens.
        pressAction: { id: "default", launchActivity: "default" },
        actions: [
          { title: "Taken", pressAction: { id: NOTIFICATION_ACTION.taken } },
          { title: "Snooze", pressAction: { id: NOTIFICATION_ACTION.snooze } },
          { title: "Skip", pressAction: { id: NOTIFICATION_ACTION.skip } },
        ],
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: scheduledAt,
      alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
    },
  );
}

// Materialises and schedules the regimen's occurrences for the current
// window. Callers are responsible for permission and channel setup.
async function syncOccurrences(regimen: Regimen, medicationName: string): Promise<void> {
  const { windowStart, windowEnd } = currentWindow();
  const generated = generateOccurrences(regimen, windowStart, windowEnd);
  const now = Date.now();

  const existing = await db.query.doseOccurrences.findMany({
    where: eq(doseOccurrences.regimenId, regimen.id),
  });
  // Any live row at a time means that slot is handled — upcoming, taken,
  // skipped or missed alike. Only "cancelled" rows (left by an edit, see
  // cancelRegimen) are ignored, so an edited rule landing on the same clock
  // time as the old one still gets a fresh row. An earlier version counted
  // only "upcoming" rows, which re-booked any dose already taken today on
  // every refill. Both found 2026-09-24/25 — see STATE.md.
  const handledTimes = new Set(
    existing.filter((row) => row.status !== "cancelled").map((row) => row.scheduledAt),
  );

  for (const occurrence of generated) {
    // The window starts at midnight today, so it includes times already
    // gone. Never book those: a schedule saved at noon shouldn't invent a
    // missed 8am dose, and the OS can't fire a reminder in the past.
    if (occurrence.scheduledAt <= now || handledTimes.has(occurrence.scheduledAt)) {
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

    await scheduleOccurrenceNotification(inserted.id, medicationName, inserted.scheduledAt);

    await db
      .update(doseOccurrences)
      .set({ actualNotificationId: inserted.id })
      .where(eq(doseOccurrences.id, inserted.id));

    await logExpectedFire(inserted.id, inserted.scheduledAt, REMINDER_CHANNEL_ID);
  }
}

let refillInFlight: Promise<void> | null = null;

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

    await syncOccurrences(regimen, medication.name);
  },

  async cancelRegimen(regimenId: string): Promise<void> {
    const rows = await db.query.doseOccurrences.findMany({
      where: eq(doseOccurrences.regimenId, regimenId),
    });
    // Future doses only. A dose already past its time is part of the
    // record — untouched, it reads as missed in History — and cancelling
    // it here would erase that miss whenever the schedule was edited or
    // the medicine archived. Found 2026-09-25 while wiring refills.
    const now = Date.now();
    const upcoming = rows.filter((row) => row.status === "upcoming" && row.scheduledAt > now);
    const idsToCancel = upcoming
      .filter((row) => row.actualNotificationId)
      .map((row) => row.actualNotificationId as string);

    if (idsToCancel.length > 0) {
      await notifee.cancelTriggerNotifications(idsToCancel);
    }

    // Mark them cancelled, not left at "upcoming" — otherwise these rows
    // look like doses still pending forever, and the heartbeat's
    // reconcile() would eventually flag them as suspected misses once their
    // time passes, even though nothing was ever supposed to fire. Found
    // while building schedule editing — see STATE.md.
    for (const row of upcoming) {
      await db
        .update(doseOccurrences)
        .set({ status: "cancelled" })
        .where(eq(doseOccurrences.id, row.id));
    }
  },

  // Tops the rolling window back up to WINDOW_DAYS ahead. Without this,
  // each regimen only ever has the week that existed when it was saved,
  // and reminders silently stop a week later. Runs on launch, on return to
  // foreground, and from the background heartbeat task (CLAUDE.md §3).
  async refillWindow(): Promise<void> {
    // Launch and foreground can fire close together. Two overlapping runs
    // would both see a slot as empty and book it twice.
    if (refillInFlight) return refillInFlight;
    refillInFlight = (async () => {
      if (!(await hasPermission())) return;
      await ensureChannel();
      const activeRegimens = await db.query.regimens.findMany({
        where: eq(regimens.active, true),
        with: { medication: true },
      });
      for (const row of activeRegimens) {
        if (row.medication.archivedAt != null) continue;
        await syncOccurrences(toDomainRegimen(row), row.medication.name);
      }
    })().finally(() => {
      refillInFlight = null;
    });
    return refillInFlight;
  },

  async pendingCount(): Promise<number> {
    const ids = await notifee.getTriggerNotificationIds();
    return ids.length;
  },
};
