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

/** Epoch ms of the midnight that ends the given YYYY-MM-DD local date. */
function endOfLocalDate(dateString: string): number {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d + 1).getTime();
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

export const SNOOZE_MS = 10 * 60_000;

/**
 * When a pending dose's reminder should next go off: its scheduled time,
 * or 10 minutes after it was last snoozed. Snooze works from whichever is
 * later of the press and the scheduled time, so a dose snoozed before it
 * was due is delayed rather than pulled forward.
 */
export function nextFireAt(row: { scheduledAt: number; lastSnoozedAt: number | null }): number {
  if (row.lastSnoozedAt == null) return row.scheduledAt;
  return Math.max(row.lastSnoozedAt, row.scheduledAt) + SNOOZE_MS;
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

// Every operation that books or cancels doses runs through this queue, one
// at a time. Each reads existing rows, then writes over several awaits; two
// interleaved runs both see a slot as empty and book it twice. Found
// 2026-09-25: a refill (started by returning to the app) overlapped a
// schedule save and double-booked every day after the first.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

type OccurrenceRow = typeof doseOccurrences.$inferSelect;

// Cancelled, not deleted or left at "upcoming" — an upcoming row looks
// pending forever, and the heartbeat's reconcile() would later flag it as a
// suspected miss though nothing was ever meant to fire.
async function cancelRows(rows: OccurrenceRow[]): Promise<void> {
  for (const row of rows) {
    await notifee.cancelNotification(row.actualNotificationId ?? row.id);
    await db
      .update(doseOccurrences)
      .set({ status: "cancelled" })
      .where(eq(doseOccurrences.id, row.id));
  }
}

// Future doses only. A dose already past its time is part of the record —
// untouched, it reads as missed in History — and cancelling it would erase
// that miss whenever the schedule was edited or the medicine archived.
async function cancelFuture(regimenId: string): Promise<void> {
  const now = Date.now();
  const rows = await db.query.doseOccurrences.findMany({
    where: eq(doseOccurrences.regimenId, regimenId),
  });
  await cancelRows(rows.filter((row) => row.status === "upcoming" && row.scheduledAt > now));
}

/**
 * Brings the regimen's future doses in the window to exactly what its rule
 * says: books missing slots, cancels upcoming doses the rule no longer
 * produces (a schedule edit), and cancels extra rows at the same time (a
 * past double-booking). Callers handle permission and channel setup, and
 * must be running inside `exclusive`.
 */
async function syncOccurrences(regimen: Regimen, medicationName: string): Promise<void> {
  const { windowStart, windowEnd } = currentWindow();
  const now = Date.now();
  const windowEndMs = endOfLocalDate(windowEnd);
  // The window starts at midnight today, so it includes times already gone.
  // Never book those: a schedule saved at noon shouldn't invent a missed 8am
  // dose, and the OS can't fire a reminder in the past.
  const wanted = new Set(
    generateOccurrences(regimen, windowStart, windowEnd)
      .map((o) => o.scheduledAt)
      .filter((t) => t > now),
  );

  const existing = await db.query.doseOccurrences.findMany({
    where: eq(doseOccurrences.regimenId, regimen.id),
  });

  // Any live row at a time means that slot is handled — upcoming, taken,
  // skipped or missed alike. Cancelled rows don't count, so an edited rule
  // landing on the same clock time as the old one still gets a fresh row.
  const handledTimes = new Set<number>();
  const toCancel: OccurrenceRow[] = [];
  for (const row of existing) {
    if (row.status === "cancelled") continue;
    const futurePending =
      row.status === "upcoming" && row.scheduledAt > now && row.scheduledAt < windowEndMs;
    if (futurePending && (!wanted.has(row.scheduledAt) || handledTimes.has(row.scheduledAt))) {
      toCancel.push(row);
      continue;
    }
    handledTimes.add(row.scheduledAt);
  }
  await cancelRows(toCancel);

  for (const scheduledAt of wanted) {
    if (handledTimes.has(scheduledAt)) continue;

    const [inserted] = await db
      .insert(doseOccurrences)
      .values({
        id: Crypto.randomUUID(),
        regimenId: regimen.id,
        scheduledAt,
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

/**
 * Re-creates the OS alarm behind every pending reminder. Force-stopping an
 * app — Android's "Force stop" button, `adb shell am force-stop`, some OEM
 * battery tools — deletes all its alarms, and neither Notifee nor the
 * database notices: rows stay "upcoming", Notifee still lists the triggers,
 * and nothing ever fires. Found 2026-09-25: 26 live future doses, zero
 * pending alarms. Re-creating a trigger with the same id replaces it, so
 * this is safe to repeat. Run on every launch — a force-stopped app runs no
 * code until it is next opened, so launch is the earliest point to repair.
 * Android-only: iOS never drops pending notifications this way.
 */
export function rearmPendingAlarms(): Promise<void> {
  return exclusive(async () => {
    if (!(await hasPermission())) return;
    await ensureChannel();
    const now = Date.now();
    const pending = await db.query.doseOccurrences.findMany({
      where: eq(doseOccurrences.status, "upcoming"),
      with: { regimen: { with: { medication: true } } },
    });
    for (const row of pending) {
      const fireAt = nextFireAt(row);
      if (fireAt <= now) continue;
      if (!row.regimen.active || row.regimen.medication.archivedAt != null) continue;
      await scheduleOccurrenceNotification(row.id, row.regimen.medication.name, fireAt);
    }
  });
}

let refillInFlight: Promise<void> | null = null;

export const AndroidScheduler: Scheduler = {
  /**
   * Makes the regimen's future doses match its current rule. Safe to call
   * repeatedly, and after an edit — it cancels doses the old rule booked.
   */
  async syncRegimen(regimen: Regimen): Promise<void> {
    await ensurePermission();
    await ensureChannel();

    await exclusive(async () => {
      const medication = await db.query.medications.findFirst({
        where: eq(medications.id, regimen.medicationId),
      });
      if (!medication) {
        throw new Error(`syncRegimen: no medication found for id ${regimen.medicationId}`);
      }
      if (!regimen.active) {
        await cancelFuture(regimen.id);
        return;
      }
      await syncOccurrences(regimen, medication.name);
    });
  },

  async cancelRegimen(regimenId: string): Promise<void> {
    await exclusive(() => cancelFuture(regimenId));
  },

  // Tops the rolling window back up to WINDOW_DAYS ahead. Without this,
  // each regimen only ever has the week that existed when it was saved,
  // and reminders silently stop a week later. Runs on launch, on return to
  // foreground, and from the background heartbeat task (CLAUDE.md §3).
  async refillWindow(): Promise<void> {
    // Launch and foreground can fire close together. Two overlapping runs
    // would both see a slot as empty and book it twice.
    if (refillInFlight) return refillInFlight;
    refillInFlight = exclusive(async () => {
      if (!(await hasPermission())) return;
      await ensureChannel();
      // Read inside the queue, so a refill sees any schedule edit saved
      // before it ran rather than re-booking the old rule.
      const activeRegimens = await db.query.regimens.findMany({
        where: eq(regimens.active, true),
        with: { medication: true },
      });
      for (const row of activeRegimens) {
        if (row.medication.archivedAt != null) continue;
        await syncOccurrences(toDomainRegimen(row), row.medication.name);
      }
    }).finally(() => {
      refillInFlight = null;
    });
    return refillInFlight;
  },

  async pendingCount(): Promise<number> {
    const ids = await notifee.getTriggerNotificationIds();
    return ids.length;
  },
};
