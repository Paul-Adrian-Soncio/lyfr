// What happened to a dose, and when, for display in History.
//
// A corrected dose shows the correction, not acknowledgedAt: correcting a
// dose to "taken" sets acknowledgedAt to the time of the correction, which
// is not when the dose was taken, so "Taken at <that time>" would be false.

export type DoseActivity =
  | { kind: "snoozed"; at: number; count: number }
  | { kind: "taken" | "skipped"; at: number }
  | { kind: "changed"; at: number; from: string; to: string };

export interface DoseActivityInput {
  status: string;
  acknowledgedAt: number | null;
  snoozeCount: number;
  lastSnoozedAt: number | null;
  /** Newest first. */
  edits: { previousStatus: string; newStatus: string; editedAt: number }[];
}

export function doseActivity(dose: DoseActivityInput): DoseActivity[] {
  const activity: DoseActivity[] = [];

  if (dose.snoozeCount > 0 && dose.lastSnoozedAt != null) {
    activity.push({ kind: "snoozed", at: dose.lastSnoozedAt, count: dose.snoozeCount });
  }

  const latestEdit = dose.edits[0];
  if (latestEdit) {
    activity.push({
      kind: "changed",
      at: latestEdit.editedAt,
      from: latestEdit.previousStatus,
      to: latestEdit.newStatus,
    });
  } else if ((dose.status === "taken" || dose.status === "skipped") && dose.acknowledgedAt != null) {
    activity.push({ kind: dose.status, at: dose.acknowledgedAt });
  }

  return activity;
}
