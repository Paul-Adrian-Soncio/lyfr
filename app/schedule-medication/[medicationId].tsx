// Schedule creation screen — "Step 2 of 2" after Add Medicine, per the
// mockup's AddMedication.dc.html footer ("Next: set schedule") and
// CLAUDE.md §6, which lists scheduling as a distinct feature area from the
// medication library. No mockup exists for this screen; visual language
// (cards, pills, stepper pattern) matches the rest of the app regardless.
//
// See CLAUDE.md §6 for V1 rule types: fixed daily times, specific weekdays,
// every N days, with a start date and optional end date.

import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { db } from "@/db/client";
import { medications, regimens } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { LocalTime, Regimen, RuleConfig, Weekday } from "@/domain/regimen";
import { AndroidScheduler } from "@/scheduling/AndroidScheduler";
import { TimeStepper } from "@/ui/TimeStepper";
import { brand, light, radii, typography } from "@/theme/tokens";

type RuleType = RuleConfig["type"];

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

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateString: string, days: number): string {
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

export default function ScheduleMedicationScreen() {
  const { medicationId } = useLocalSearchParams<{ medicationId: string }>();
  const [medicationName, setMedicationName] = useState<string | null>(null);

  const [ruleType, setRuleType] = useState<RuleType>("fixed_daily");
  const [times, setTimes] = useState<LocalTime[]>(["08:00"]);
  const [weekdays, setWeekdays] = useState<Weekday[]>([1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState(2);
  const [startDate, setStartDate] = useState(() => toDateString(new Date()));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(() => addDays(toDateString(new Date()), 7));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.query.medications.findFirst({ where: eq(medications.id, medicationId) }).then((row) => {
      if (!row) {
        Alert.alert("Not found", "This medicine no longer exists.");
        router.back();
        return;
      }
      setMedicationName(row.name);
    });
  }, [medicationId]);

  function updateTime(index: number, value: LocalTime) {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addTime() {
    setTimes((prev) => [...prev, "12:00"]);
  }

  function removeTime(index: number) {
    setTimes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function toggleWeekday(day: Weekday) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function buildRule(): RuleConfig | null {
    if (ruleType === "fixed_daily") {
      return { type: "fixed_daily", times };
    }
    if (ruleType === "specific_weekdays") {
      if (weekdays.length === 0) return null;
      return { type: "specific_weekdays", weekdays, times };
    }
    return { type: "every_n_days", intervalDays, times };
  }

  async function handleSave() {
    const rule = buildRule();
    if (!rule) {
      Alert.alert("Pick at least one day", "Choose which days this applies to.");
      return;
    }

    setSaving(true);
    try {
      const regimen: Regimen = {
        id: Crypto.randomUUID(),
        medicationId,
        rule,
        startDate,
        endDate: hasEndDate ? endDate : null,
        active: true,
      };

      await db.insert(regimens).values({
        id: regimen.id,
        medicationId: regimen.medicationId,
        ruleType: regimen.rule.type,
        ruleConfig: regimen.rule,
        startDate: regimen.startDate,
        endDate: regimen.endDate,
        active: regimen.active,
      });

      await AndroidScheduler.syncRegimen(regimen);

      router.dismissTo("/medications");
    } catch (e) {
      Alert.alert(
        "Couldn't set up reminders",
        e instanceof Error ? e.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 5 L8 12 L15 19"
              stroke={brand.deep}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text allowFontScaling style={styles.headerTitle}>
          Set schedule
        </Text>
        <Text allowFontScaling style={styles.stepLabel}>
          Step 2 of 2
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        {medicationName && (
          <Text allowFontScaling style={styles.subtitle}>
            For {medicationName}
          </Text>
        )}

        <View style={styles.field}>
          <Text allowFontScaling style={styles.label}>
            How often
          </Text>
          <View style={styles.ruleTypeGrid}>
            {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((type) => {
              const selected = type === ruleType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setRuleType(type)}
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

        {ruleType === "specific_weekdays" && (
          <View style={styles.field}>
            <Text allowFontScaling style={styles.label}>
              Which days
            </Text>
            <View style={styles.weekdayGrid}>
              {WEEKDAY_LABELS.map(({ value, label }) => {
                const selected = weekdays.includes(value);
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

        {ruleType === "every_n_days" && (
          <View style={styles.field}>
            <Text allowFontScaling style={styles.label}>
              Every how many days
            </Text>
            <View style={styles.intervalRow}>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setIntervalDays((n) => Math.max(2, n - 1))}
                  style={styles.stepperButton}
                  hitSlop={8}
                >
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M6 12 H18" stroke={brand.deep} strokeWidth={2.5} strokeLinecap="round" />
                  </Svg>
                </Pressable>
                <Text allowFontScaling style={styles.stepperValue}>
                  {intervalDays}
                </Text>
                <Pressable
                  onPress={() => setIntervalDays((n) => n + 1)}
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
            What time{times.length > 1 ? "s" : ""}
          </Text>
          {times.map((time, index) => (
            <View key={index} style={styles.timeRow}>
              <TimeStepper value={time} onChange={(value) => updateTime(index, value)} />
              {times.length > 1 && (
                <Pressable onPress={() => removeTime(index)} hitSlop={8} style={styles.removeTimeButton}>
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
            dateString={startDate}
            onChange={setStartDate}
            minDateString={toDateString(new Date())}
          />
        </View>

        <View style={styles.field}>
          <Pressable style={styles.endDateToggleRow} onPress={() => setHasEndDate((v) => !v)}>
            <View style={[styles.checkbox, hasEndDate && styles.checkboxChecked]}>
              {hasEndDate && (
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
          {hasEndDate && (
            <DateStepperRow dateString={endDate} onChange={setEndDate} minDateString={startDate} />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text allowFontScaling style={styles.saveButtonText}>
            {saving ? "Setting up…" : "Save schedule"}
          </Text>
        </Pressable>
      </View>
    </View>
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
          <Path d="M6 12 H18" stroke={atMin ? light.textMuted : brand.deep} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Pressable>
      <Text allowFontScaling style={styles.dateValue}>
        {formatDateForDisplay(dateString)}
      </Text>
      <Pressable onPress={() => onChange(addDays(dateString, 1))} style={styles.stepperButton} hitSlop={8}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5 V19 M5 12 H19" stroke={brand.deep} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: light.text,
    flexGrow: 1,
  },
  stepLabel: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
  },
  form: {
    gap: 20,
    padding: 20,
    paddingTop: 0,
  },
  subtitle: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
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
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: brand.frost,
  },
  saveButton: {
    height: 60,
    borderRadius: radii.buttonLarge,
    backgroundColor: brand.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
});
