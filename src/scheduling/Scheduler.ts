// The platform-agnostic scheduling contract. Keep this narrow — see
// CLAUDE.md §3. Platform-specific code (Notifee, AlarmManager types, Doze
// handling) lives behind this interface and nowhere else. Do not scatter
// `Platform.OS` checks outside this directory.

import type { Regimen } from "@/domain/regimen";

export interface Scheduler {
  /** Idempotent: safe to call repeatedly for the same regimen. */
  syncRegimen(regimen: Regimen): Promise<void>;
  cancelRegimen(id: string): Promise<void>;
  /** Top up pending notifications so they never run dry. See CLAUDE.md §3 — iOS caps pending local notifications at 64. */
  refillWindow(): Promise<void>;
  /** Health check: how many notifications are currently scheduled with the OS. */
  pendingCount(): Promise<number>;
}
