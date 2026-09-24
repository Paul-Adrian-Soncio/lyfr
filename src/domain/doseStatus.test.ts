import { describe, expect, it } from "vitest";
import {
  correctionOptions,
  effectiveStatus,
  MISSED_GRACE_MS,
  summarizeDay,
} from "./doseStatus";

const scheduledAt = Date.UTC(2026, 8, 24, 8, 0);

describe("effectiveStatus", () => {
  it("keeps an untouched dose upcoming before its time", () => {
    expect(effectiveStatus({ status: "upcoming", scheduledAt }, scheduledAt - 60_000)).toBe("upcoming");
  });

  it("keeps an untouched dose upcoming through the grace period", () => {
    expect(effectiveStatus({ status: "upcoming", scheduledAt }, scheduledAt + MISSED_GRACE_MS)).toBe(
      "upcoming"
    );
  });

  it("marks an untouched dose missed once the grace period has passed", () => {
    expect(
      effectiveStatus({ status: "upcoming", scheduledAt }, scheduledAt + MISSED_GRACE_MS + 1)
    ).toBe("missed");
  });

  it("never overrides a status someone set, however late", () => {
    const later = scheduledAt + MISSED_GRACE_MS * 10;
    expect(effectiveStatus({ status: "taken", scheduledAt }, later)).toBe("taken");
    expect(effectiveStatus({ status: "skipped", scheduledAt }, later)).toBe("skipped");
    expect(effectiveStatus({ status: "missed", scheduledAt }, scheduledAt - 1)).toBe("missed");
  });
});

describe("summarizeDay", () => {
  it("returns no overall status for a day with nothing scheduled", () => {
    expect(summarizeDay([])).toEqual({ total: 0, taken: 0, overall: null });
  });

  it("reads as missed if any dose was missed, even alongside upcoming ones", () => {
    expect(summarizeDay(["taken", "missed", "upcoming"]).overall).toBe("missed");
  });

  it("reads as upcoming while any dose is still to come", () => {
    expect(summarizeDay(["taken", "upcoming"]).overall).toBe("upcoming");
  });

  it("reads as done once every dose was taken or skipped", () => {
    expect(summarizeDay(["taken", "skipped"])).toEqual({ total: 2, taken: 1, overall: "taken" });
  });
});

describe("correctionOptions", () => {
  it("offers the two statuses the dose doesn't already have", () => {
    expect(correctionOptions("missed")).toEqual(["taken", "skipped"]);
    expect(correctionOptions("taken")).toEqual(["skipped", "missed"]);
  });
});
