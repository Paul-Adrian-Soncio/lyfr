// Regimen rule types. See CLAUDE.md §6 for V1 scope and §5 for why
// `rule_config` is JSON rather than a column per rule type.
//
// Times are always local wall-clock (HH:mm, 24h). The generator resolves
// wall-clock time to a UTC instant per-occurrence, so a trip abroad does not
// shift the schedule — see CLAUDE.md §4, "Time zone handling".

export type LocalTime = `${number}:${number}`;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, matches Date#getDay()

export interface FixedDailyRule {
  type: "fixed_daily";
  times: LocalTime[];
}

export interface SpecificWeekdaysRule {
  type: "specific_weekdays";
  weekdays: Weekday[];
  times: LocalTime[];
}

export interface EveryNDaysRule {
  type: "every_n_days";
  intervalDays: number;
  times: LocalTime[];
}

export type RuleConfig = FixedDailyRule | SpecificWeekdaysRule | EveryNDaysRule;

export interface Regimen {
  id: string;
  medicationId: string;
  rule: RuleConfig;
  /** Local calendar date the regimen starts, as an ISO date string (YYYY-MM-DD). */
  startDate: string;
  /** Local calendar date the regimen ends (inclusive), or null if open-ended. */
  endDate: string | null;
  active: boolean;
}
