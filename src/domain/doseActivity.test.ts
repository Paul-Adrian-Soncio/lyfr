import { describe, expect, it } from "vitest";
import { doseActivity, type DoseActivityInput } from "./doseActivity";

const base: DoseActivityInput = {
  status: "upcoming",
  acknowledgedAt: null,
  snoozeCount: 0,
  lastSnoozedAt: null,
  edits: [],
};

describe("doseActivity", () => {
  it("shows nothing for an untouched dose", () => {
    expect(doseActivity(base)).toEqual([]);
  });

  it("shows when a dose was taken", () => {
    expect(doseActivity({ ...base, status: "taken", acknowledgedAt: 100 })).toEqual([
      { kind: "taken", at: 100 },
    ]);
  });

  it("shows the snooze before the outcome", () => {
    expect(
      doseActivity({ ...base, status: "taken", acknowledgedAt: 300, snoozeCount: 2, lastSnoozedAt: 200 })
    ).toEqual([
      { kind: "snoozed", at: 200, count: 2 },
      { kind: "taken", at: 300 },
    ]);
  });

  it("shows a snooze on a dose that's still pending", () => {
    expect(doseActivity({ ...base, snoozeCount: 1, lastSnoozedAt: 50 })).toEqual([
      { kind: "snoozed", at: 50, count: 1 },
    ]);
  });

  it("shows the latest correction instead of acknowledgedAt, which is the correction time", () => {
    expect(
      doseActivity({
        ...base,
        status: "taken",
        acknowledgedAt: 900,
        edits: [
          { previousStatus: "skipped", newStatus: "taken", editedAt: 900 },
          { previousStatus: "missed", newStatus: "skipped", editedAt: 500 },
        ],
      })
    ).toEqual([{ kind: "changed", at: 900, from: "skipped", to: "taken" }]);
  });
});
