// Periodic background heartbeat check on Android. See CLAUDE.md §3: "via a
// periodic background task on Android, compare expected against observed."
//
// Real caveat worth keeping visible: this task runs under Android's
// WorkManager, which is itself subject to the exact OEM battery
// restrictions the heartbeat exists to detect. On a device where the app
// isn't whitelisted, this task may not run reliably either — it is a
// second signal on top of launch-time reconciliation, not a replacement
// for it. Launch-time reconciliation (src/scheduling/heartbeat.ts's
// `reconcile()`, called from app/_layout.tsx) is the one guarantee: it
// runs synchronously whenever the user opens the app, independent of
// whether the OS ever granted this background task any time to run.

import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { reconcile } from "./heartbeat";

export const HEARTBEAT_TASK_NAME = "lyfr-heartbeat-check";

TaskManager.defineTask(HEARTBEAT_TASK_NAME, async () => {
  try {
    await reconcile();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Registers the periodic heartbeat task. Idempotent — safe to call on every
 * app launch. The interval is a minimum, not a guarantee; Android decides
 * the actual cadence based on device state and battery restrictions.
 */
export async function registerBackgroundHeartbeat(): Promise<void> {
  await BackgroundTask.registerTaskAsync(HEARTBEAT_TASK_NAME, {
    minimumInterval: 15, // minutes; Android's WorkManager floor
  });
}
