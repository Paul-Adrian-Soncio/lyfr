import { describe, expect, it } from "vitest";
import { generateOccurrences } from "./occurrenceGenerator";
import type { Regimen } from "./regimen";

function baseRegimen(overrides: Partial<Regimen>): Regimen {
  return {
    id: "reg-1",
    medicationId: "med-1",
    rule: { type: "fixed_daily", times: ["08:00"] },
    startDate: "2026-01-01",
    endDate: null,
    active: true,
    ...overrides,
  };
}

function toLocalStrings(occurrences: { scheduledAt: number }[]): string[] {
  return occurrences
    .map((o) => new Date(o.scheduledAt))
    .sort((a, b) => a.getTime() - b.getTime())
    .map(
      (d) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

describe("fixed_daily", () => {
  it("produces one occurrence per day per time", () => {
    const regimen = baseRegimen({
      rule: { type: "fixed_daily", times: ["08:00", "20:00"] },
    });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-02");
    expect(toLocalStrings(result)).toEqual([
      "2026-01-01 08:00",
      "2026-01-01 20:00",
      "2026-01-02 08:00",
      "2026-01-02 20:00",
    ]);
  });

  it("clips to the regimen start date even if the window starts earlier", () => {
    const regimen = baseRegimen({ startDate: "2026-01-03" });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-04");
    expect(toLocalStrings(result)).toEqual(["2026-01-03 08:00", "2026-01-04 08:00"]);
  });

  it("clips to the regimen end date even if the window ends later", () => {
    const regimen = baseRegimen({ endDate: "2026-01-02" });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-05");
    expect(toLocalStrings(result)).toEqual(["2026-01-01 08:00", "2026-01-02 08:00"]);
  });

  it("produces nothing when the window falls entirely outside the regimen range", () => {
    const regimen = baseRegimen({ startDate: "2026-02-01" });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-31");
    expect(result).toEqual([]);
  });

  it("produces nothing when the regimen is inactive", () => {
    const regimen = baseRegimen({ active: false });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-05");
    expect(result).toEqual([]);
  });
});

describe("specific_weekdays", () => {
  it("only produces occurrences on the configured weekdays", () => {
    // 2026-01-01 is a Thursday; Mon/Wed/Fri = weekdays 1, 3, 5
    const regimen = baseRegimen({
      rule: { type: "specific_weekdays", weekdays: [1, 3, 5], times: ["09:00"] },
      startDate: "2026-01-01",
    });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-11");
    // Fri Jan 2, Mon Jan 5, Wed Jan 7, Fri Jan 9
    expect(toLocalStrings(result)).toEqual([
      "2026-01-02 09:00",
      "2026-01-05 09:00",
      "2026-01-07 09:00",
      "2026-01-09 09:00",
    ]);
  });
});

describe("every_n_days", () => {
  it("fires on the start date and every N days after", () => {
    const regimen = baseRegimen({
      rule: { type: "every_n_days", intervalDays: 3, times: ["07:00"] },
      startDate: "2026-01-01",
    });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-10");
    expect(toLocalStrings(result)).toEqual([
      "2026-01-01 07:00",
      "2026-01-04 07:00",
      "2026-01-07 07:00",
      "2026-01-10 07:00",
    ]);
  });

  it("does not fire on days that don't align with the interval, even mid-window", () => {
    const regimen = baseRegimen({
      rule: { type: "every_n_days", intervalDays: 5, times: ["07:00"] },
      startDate: "2026-01-01",
    });
    // Window starts after the regimen start, so the interval must still be
    // computed from the regimen's own start date, not the window start.
    const result = generateOccurrences(regimen, "2026-01-03", "2026-01-07");
    expect(toLocalStrings(result)).toEqual(["2026-01-06 07:00"]);
  });
});

describe("multiple times per rule", () => {
  it("keeps times sorted within a day when multiple times are configured out of order", () => {
    const regimen = baseRegimen({
      rule: { type: "fixed_daily", times: ["20:00", "08:00", "13:00"] },
    });
    const result = generateOccurrences(regimen, "2026-01-01", "2026-01-01");
    expect(toLocalStrings(result)).toEqual([
      "2026-01-01 08:00",
      "2026-01-01 13:00",
      "2026-01-01 20:00",
    ]);
  });
});
