// The Samsung battery walkthrough's underlying checks and actions. See
// CLAUDE.md §8 for the specific settings this exists to fix, and §3 for why
// it must be re-enterable (not just one-time onboarding) — the reliability
// banner routes back into this if the heartbeat later detects real misses.
//
// Two of CLAUDE.md §8's four settings map directly onto standard Android
// APIs Notifee exposes; the other two are Samsung-specific screens reached
// only through the OEM power-manager intent, which cannot be checked
// programmatically — only opened. See WalkthroughStep below for which is
// which, and STATE.md for what's been verified on-device vs. assumed.

import notifee from "@notifee/react-native";

export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  /** True if this step's state can be checked programmatically. */
  checkable: boolean;
  isSatisfied: () => Promise<boolean | null>;
  open: () => Promise<void>;
}

export const batteryOptimizationStep: WalkthroughStep = {
  id: "battery-optimization",
  title: "Turn off battery optimisation for Lyfr",
  // Leads with the actual action, not the Android setting's name — "battery
  // optimisation" reads as something you'd want left on. Found via on-device
  // testing 2026-09-22 (Samsung tablet): openBatteryOptimizationSettings()
  // opens a general app list, filtered to a subset by default — Lyfr does
  // not appear until switching that filter to "All apps." Without calling
  // that out explicitly, a user would hit a dead end (app not in the list)
  // and likely give up. See STATE.md.
  description:
    "On the next screen, if you don't see Lyfr in the list, switch the filter to \"All apps.\" Then choose Lyfr and select \"Don't optimise\" or \"Unrestricted.\"",
  checkable: true,
  isSatisfied: async () => {
    const enabled = await notifee.isBatteryOptimizationEnabled();
    // isBatteryOptimizationEnabled() true means optimisation IS restricting
    // the app — satisfied means the opposite.
    return !enabled;
  },
  open: () => notifee.openBatteryOptimizationSettings(),
};

export const exactAlarmStep: WalkthroughStep = {
  id: "exact-alarm",
  title: "Alarm permission",
  description: "Allow Lyfr to schedule exact alarms, required for reminders to fire on time.",
  checkable: false, // no isXEnabled() counterpart exposed by Notifee for this one
  isSatisfied: async () => null,
  open: () => notifee.openAlarmPermissionSettings(),
};

// Samsung's own "Background usage limits" screen (Never sleeping apps /
// Sleeping apps / Deep sleeping apps) and "Auto-disable unused app" both
// live behind this same OEM intent — Notifee does not distinguish between
// them, and there is no way to check either one's state programmatically.
// To verify, not assume: confirm on the Samsung tablet that
// openPowerManagerSettings() actually lands on the "Background usage
// limits" screen specifically, not a generic battery page — see STATE.md.
export const oemPowerManagerStep: WalkthroughStep = {
  id: "oem-power-manager",
  title: "Background usage limits",
  description:
    "Add Lyfr to Never sleeping apps, and turn off Auto-disable unused app, so it isn't put to sleep for being opened rarely.",
  checkable: false,
  isSatisfied: async () => null,
  open: () => notifee.openPowerManagerSettings(),
};

export interface DeviceSupport {
  manufacturer?: string;
  model?: string;
  /** False if getPowerManagerInfo() returned no activity — the OEM step is a no-op on this device. */
  oemStepAvailable: boolean;
}

export async function checkDeviceSupport(): Promise<DeviceSupport> {
  const info = await notifee.getPowerManagerInfo();
  return {
    manufacturer: info.manufacturer,
    model: info.model,
    oemStepAvailable: info.activity != null,
  };
}

export const walkthroughSteps: WalkthroughStep[] = [
  batteryOptimizationStep,
  exactAlarmStep,
  oemPowerManagerStep,
];
