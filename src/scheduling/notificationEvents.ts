// Wires Notifee's delivery/action events into the heartbeat log and dose
// status. Registered once, outside the component tree — see index.js and
// CLAUDE.md §6, "Actions: Taken, Snooze, Skip — handled without opening the
// app."
//
// DELIVERED here is a best-effort signal, not the source of truth for
// reliability — see src/scheduling/heartbeat.ts for why launch-time
// reconciliation is what actually matters.

import notifee, { EventType } from "@notifee/react-native";
import type { Event } from "@notifee/react-native";
import { NOTIFICATION_ACTION } from "./AndroidScheduler";
import { markSkipped, markTaken, snooze } from "./doseActions";
import { logObservedFire } from "./heartbeat";

export async function handleEvent({ type, detail }: Event): Promise<void> {
  const occurrenceId = detail.notification?.id;
  if (!occurrenceId) return;

  if (type === EventType.DELIVERED) {
    await logObservedFire(occurrenceId);
    return;
  }

  // The notification's own buttons. Same functions the Today screen calls,
  // so the two paths can't drift. Each one also clears the notification.
  if (type === EventType.ACTION_PRESS) {
    switch (detail.pressAction?.id) {
      case NOTIFICATION_ACTION.taken:
        await markTaken(occurrenceId);
        break;
      case NOTIFICATION_ACTION.skip:
        await markSkipped(occurrenceId);
        break;
      case NOTIFICATION_ACTION.snooze:
        await snooze(occurrenceId);
        break;
    }
  }
}

/**
 * Registers the background handler — catches events while the app is not
 * in the foreground. Must be called once, outside the component tree
 * (index.js), before the JS bundle finishes initializing.
 *
 * This alone does NOT catch events while the app is open — Notifee treats
 * foreground and background as separate registrations. See
 * registerForegroundEventHandler below, wired from app/_layout.tsx.
 */
export function registerNotificationEventHandlers(): void {
  notifee.onBackgroundEvent(handleEvent);
}

/**
 * Registers the foreground handler — catches events while the app is open.
 * Call from a component (app/_layout.tsx); returns the unsubscribe function
 * Notifee provides, for cleanup on unmount.
 */
export function registerForegroundEventHandler(): () => void {
  return notifee.onForegroundEvent(handleEvent);
}
