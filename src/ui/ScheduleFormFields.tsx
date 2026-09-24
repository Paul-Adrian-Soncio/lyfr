// Shared form body for schedule-medication (create) and edit-schedule —
// rule type picker, weekday grid, interval stepper, time list, start/end
// date. Extracted so both screens change together. See CLAUDE.md §6 for
// the three V1 rule types this supports.

import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { LocalTime, RuleConfig, Weekday } from "@/domain/regimen";
import { brand, light, radii, typography } from "@/theme/tokens";
import { Pressable } from "@/ui/Pressable";
import { TimeStepper } from "@/ui/TimeStepper";

export type RuleType = RuleConfig["type"];

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  fixed_daily: "Every day",
  specific_weekdays: "Specific days",
  every_n_days: "Every few days",
};

const WEEKDAY_LABELS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

function formatDateForDisplay(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export interface ScheduleFormState {
  ruleType: RuleType;
  times: LocalTime[];
  weekdays: Weekday[];
  intervalDays: number;
  startDate: string;
  hasEndDate: boolean;
  endDate: string;
}

export function buildRuleFromState(state: ScheduleFormState): RuleConfig | null {
  if (state.ruleType === "fixed_daily") {
    return { type: "fixed_daily", times: state.times };
  }
  if (state.ruleType === "specific_weekdays") {
    if (state.weekdays.length === 0) return null;
    return { type: "specific_weekdays", weekdays: state.weekdays, times: state.times };
  }
  return { type: "every_n_days", intervalDays: state.intervalDays, times: state.times };
}

interface ScheduleFormFieldsProps {
  state: ScheduleFormState;
  onChange: (next: ScheduleFormState) => void;
  headerExtra?: React.ReactNode;
}

export function ScheduleFormFields({ state, onChange, headerExtra }: ScheduleFormFieldsProps) {
  function updateTime(index: number, value: LocalTime) {
    onChange({ ...state, times: state.times.map((t, i) => (i === index ? value : t)) });
  }

  function addTime() {
    onChange({ ...state, times: [...state.times, "12:00"] });
  }

  function removeTime(index: number) {
    if (state.times.length <= 1) return;
    onChange({ ...state, times: state.times.filter((_, i) => i !== index) });
  }

  function toggleWeekday(day: Weekday) {
    const next = state.weekdays.includes(day)
      ? state.weekdays.filter((d) => d !== day)
      : [...state.weekdays, day].sort();
    onChange({ ...state, weekdays: next });
  }

  return (
    <ScrollView contentContainerStyle={styles.form}>
      {headerExtra}

      <View style={styles.field}>
        <Text allowFontScaling style={styles.label}>
          How often
        </Text>
        <View style={styles.ruleTypeGrid}>
          {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((type) => {
            const selected = type === state.ruleType;
            return (
              <Pressable
                key={type}
                onPress={() => onChange({ ...state, ruleType: type })}
                style={[styles.ruleTypeButton, selected && styles.ruleTypeButtonSelected]}
              >
                <Text
                  allowFontScaling
                  style={[styles.ruleTypeText, selected && styles.ruleTypeTextSelected]}
                >
                  {RULE_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {state.ruleType === "specific_weekdays" && (
        <View style={styles.field}>
          <Text allowFontScaling style={styles.label}>
            Which days
          </Text>
          <View style={styles.weekdayGrid}>
            {WEEKDAY_LABELS.map(({ value, label }) => {
              const selected = state.weekdays.includes(value);
              return (
                <Pressable
                  key={value}
                  onPress={() => toggleWeekday(value)}
                  style={[styles.weekdayButton, selected && styles.weekdayButtonSelected]}
                >
                  <Text
                    allowFontScaling
                    style={[styles.weekdayText, selected && styles.weekdayTextSelected]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {state.ruleType === "every_n_days" && (
        <View style={styles.field}>
          <Text allowFontScaling style={styles.label}>
            Every how many days
          </Text>
          <View style={styles.intervalRow}>
            <View style={styles.stepper}>
              <Pressable
                onPress={() =>
                  onChange({ ...state, intervalDays: Math.max(2, state.intervalDays - 1) })
                }
                style={styles.stepperButton}
                hitSlop={8}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 12 H18" stroke={brand.deep} strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              </Pressable>
              <Text allowFontScaling style={styles.stepperValue}>
                {state.intervalDays}
              </Text>
              <Pressable
                onPress={() => onChange({ ...state, intervalDays: state.intervalDays + 1 })}
                style={styles.stepperButton}
                hitSlop={8}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 5 V19 M5 12 H19"
                    stroke={brand.deep}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>
            <Text allowFontScaling style={styles.intervalUnit}>
              days
            </Text>
          </View>
        </View>
      )}

      <View style={styles.field}>
        <Text allowFontScaling style={styles.label}>
          What time{state.times.length > 1 ? "s" : ""}
        </Text>
        {state.times.map((time, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are fully controlled by `state.times` and hold no state of their own, so position is the right identity.
          <View key={index} style={styles.timeRow}>
            <TimeStepper value={time} onChange={(value) => updateTime(index, value)} />
            {state.times.length > 1 && (
              <Pressable
                onPress={() => removeTime(index)}
                hitSlop={8}
                style={styles.removeTimeButton}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 6 L18 18 M6 18 L18 6"
                    stroke={light.textMuted}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable onPress={addTime} style={styles.addTimeButton}>
          <Text allowFontScaling style={styles.addTimeText}>
            + Add another time
          </Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text allowFontScaling style={styles.label}>
          Starts
        </Text>
        <DateStepperRow
          dateString={state.startDate}
          onChange={(startDate) => onChange({ ...state, startDate })}
          minDateString={toDateString(new Date())}
        />
      </View>

      <View style={styles.field}>
        <Pressable
          style={styles.endDateToggleRow}
          onPress={() => onChange({ ...state, hasEndDate: !state.hasEndDate })}
        >
          <View style={[styles.checkbox, state.hasEndDate && styles.checkboxChecked]}>
            {state.hasEndDate && (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12.5 l4.5 4.5 L19 7.5"
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>
          <Text allowFontScaling style={styles.label}>
            Set an end date
          </Text>
        </Pressable>
        {state.hasEndDate && (
          <DateStepperRow
            dateString={state.endDate}
            onChange={(endDate) => onChange({ ...state, endDate })}
            minDateString={state.startDate}
          />
        )}
      </View>
    </ScrollView>
  );
}

function DateStepperRow({
  dateString,
  onChange,
  minDateString,
}: {
  dateString: string;
  onChange: (next: string) => void;
  minDateString: string;
}) {
  const atMin = dateString <= minDateString;
  return (
    <View style={styles.dateRow}>
      <Pressable
        onPress={() => onChange(addDays(dateString, -1))}
        style={[styles.stepperButton, atMin && styles.stepperButtonDisabled]}
        hitSlop={8}
        disabled={atMin}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 12 H18"
            stroke={atMin ? light.textMuted : brand.deep}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
      <Text allowFontScaling style={styles.dateValue}>
        {formatDateForDisplay(dateString)}
      </Text>
      <Pressable
        onPress={() => onChange(addDays(dateString, 1))}
        style={styles.stepperButton}
        hitSlop={8}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5 V19 M5 12 H19"
            stroke={brand.deep}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
    padding: 20,
    paddingTop: 0,
  },
  field: {
    gap: 10,
  },
  label: {
    fontSize: typography.absoluteMinSp,
    fontWeight: "600",
    color: light.text,
  },
  ruleTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ruleTypeButton: {
    flexBasis: "48%",
    flexGrow: 1,
    height: 56,
    borderWidth: 2,
    borderColor: brand.fjord,
    borderRadius: radii.button,
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleTypeButtonSelected: {
    backgroundColor: brand.deep,
    borderColor: brand.deep,
  },
  ruleTypeText: {
    fontSize: 15,
    fontWeight: "600",
    color: light.text,
  },
  ruleTypeTextSelected: {
    color: "#FFFFFF",
  },
  weekdayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  weekdayButton: {
    width: 56,
    height: 56,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: brand.fjord,
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayButtonSelected: {
    backgroundColor: brand.deep,
    borderColor: brand.deep,
  },
  weekdayText: {
    fontSize: 15,
    fontWeight: "600",
    color: light.text,
  },
  weekdayTextSelected: {
    color: "#FFFFFF",
  },
  intervalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  intervalUnit: {
    fontSize: 20,
    color: light.text,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#5B6B78",
    borderRadius: radii.button,
    overflow: "hidden",
  },
  stepperButton: {
    width: 56,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: light.background,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    width: 64,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: light.text,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  removeTimeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addTimeButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  addTimeText: {
    fontSize: typography.bodyMinSp,
    fontWeight: "600",
    color: brand.deep,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  dateValue: {
    fontSize: 20,
    fontWeight: "700",
    color: light.text,
    minWidth: 160,
    textAlign: "center",
  },
  endDateToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#5B6B78",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: brand.deep,
    borderColor: brand.deep,
  },
});
