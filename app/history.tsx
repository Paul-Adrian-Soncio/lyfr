// History tab — CLAUDE.md §6: week view, and logs editable after the fact
// with an audit trail. Matches the mockup's History.dc.html: a 7-day strip
// ending today, then the selected day's doses. Supply tracking (the
// mockup's lower section) is a separate follow-up, see STATE.md.
//
// "Missed" is derived at read time (src/domain/doseStatus.ts), not stored,
// so a dose untouched for over two hours shows as missed here without any
// background job having had to run.

import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { type DoseActivity, doseActivity } from "@/domain/doseActivity";
import {
  correctionOptions,
  type EffectiveStatus,
  effectiveStatus,
  summarizeDay,
} from "@/domain/doseStatus";
import type { MedicationForm } from "@/domain/medication";
import { correctDose } from "@/scheduling/doseActions";
import {
  HISTORY_DAYS,
  type HistoryOccurrenceRow,
  isSameDay,
  weekDays,
  weekOccurrencesQuery,
} from "@/scheduling/historyOccurrences";
import { brand, iconColorOn, light, radii, typography } from "@/theme/tokens";
import { StatusDot, StatusPill } from "@/ui/DoseStatusBadge";
import { FormIcon } from "@/ui/FormIcon";
import { Pressable } from "@/ui/Pressable";
import { useToday } from "@/ui/useToday";

const CORRECTION_LABELS: Record<EffectiveStatus, string> = {
  taken: "It was taken",
  skipped: "It was skipped",
  missed: "It was missed",
  upcoming: "",
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Adds the weekday when the event fell on a different day from the dose,
// so a 10pm dose taken at 1am doesn't read as taken before it was due.
function formatEventTime(at: number, scheduledAt: number): string {
  const time = formatTime(at);
  if (new Date(at).toDateString() === new Date(scheduledAt).toDateString()) return time;
  return `${new Date(at).toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

function describeActivity(activity: DoseActivity, scheduledAt: number): string {
  const at = formatEventTime(activity.at, scheduledAt);
  switch (activity.kind) {
    case "snoozed":
      return activity.count === 1
        ? `Snoozed at ${at}`
        : `Snoozed ${activity.count} times, last at ${at}`;
    case "taken":
      return `Taken at ${at}`;
    case "skipped":
      return `Skipped at ${at}`;
    case "changed":
      return `Changed from ${activity.from} to ${activity.to} at ${at}`;
  }
}

function formatRange(days: Date[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`;
  }
  const short = { day: "numeric", month: "short" } as const;
  return `${first.toLocaleDateString(undefined, short)} – ${last.toLocaleDateString(undefined, short)}`;
}

function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function HistoryScreen() {
  // Stored relative to today rather than as fixed dates, so the strip
  // moves forward on its own when the day rolls over — see useToday.
  const today = useToday();
  const [weeksBack, setWeeksBack] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(HISTORY_DAYS - 1);

  const lastDay = shiftDays(today, -HISTORY_DAYS * weeksBack);
  const { data } = useLiveQuery(weekOccurrencesQuery(lastDay), [lastDay.getTime()]);
  const rows = data ?? [];
  const now = Date.now();
  const days = weekDays(lastDay);
  const selectedDay = days[selectedIndex];
  const atCurrentWeek = weeksBack === 0;

  const selectedRows = rows.filter((r) => isSameDay(r.scheduledAt, selectedDay));
  const selectedSummary = summarizeDay(selectedRows.map((r) => effectiveStatus(r, now)));

  function goToWeek(direction: -1 | 1) {
    setWeeksBack((w) => Math.max(0, w - direction));
    setSelectedIndex(HISTORY_DAYS - 1);
  }

  function handleCorrect(row: HistoryOccurrenceRow) {
    const current = effectiveStatus(row, now);
    const [a, b] = correctionOptions(current);
    Alert.alert(
      "Correct this dose?",
      `${row.regimen.medication.name} at ${formatTime(row.scheduledAt)} is marked ${current}. What actually happened?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: CORRECTION_LABELS[a], onPress: () => correctDose(row.id, current, a) },
        { text: CORRECTION_LABELS[b], onPress: () => correctDose(row.id, current, b) },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.main}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Chevron direction="left" color={brand.deep} />
        </Pressable>
        <Text allowFontScaling style={styles.title}>
          History
        </Text>
      </View>

      <View style={styles.weekNav}>
        <Pressable
          onPress={() => goToWeek(-1)}
          style={styles.weekButton}
          accessibilityLabel="Previous week"
        >
          <Chevron direction="left" color={brand.deep} />
        </Pressable>
        <Text allowFontScaling style={styles.rangeText}>
          {formatRange(days)}
        </Text>
        <Pressable
          onPress={() => goToWeek(1)}
          style={[styles.weekButton, atCurrentWeek && styles.weekButtonDisabled]}
          disabled={atCurrentWeek}
          accessibilityLabel="Next week"
        >
          <Chevron direction="right" color={atCurrentWeek ? brand.fjord : brand.deep} />
        </Pressable>
      </View>

      <View style={styles.weekStrip}>
        {days.map((day, index) => {
          const dayRows = rows.filter((r) => isSameDay(r.scheduledAt, day));
          const summary = summarizeDay(dayRows.map((r) => effectiveStatus(r, now)));
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={day.toDateString()}
              onPress={() => setSelectedIndex(index)}
              style={[styles.dayCell, selected && styles.dayCellSelected]}
              accessibilityLabel={`${day.toDateString()}, ${summary.taken} of ${summary.total} taken`}
            >
              <Text allowFontScaling style={styles.dayLetter}>
                {day.toLocaleDateString(undefined, { weekday: "narrow" })}
              </Text>
              <Text allowFontScaling style={styles.dayNumber}>
                {day.getDate()}
              </Text>
              {summary.overall ? (
                <StatusDot status={summary.overall} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
              <Text allowFontScaling style={styles.dayCount}>
                {summary.total > 0 ? `${summary.taken}/${summary.total}` : "–"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.daySection}>
        <View style={styles.dayHeader}>
          <Text allowFontScaling style={styles.dayTitle}>
            {selectedDay.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
          {selectedSummary.total > 0 && (
            <Text allowFontScaling style={styles.dayHeaderCount}>
              {selectedSummary.taken} of {selectedSummary.total}
            </Text>
          )}
        </View>

        {selectedRows.length === 0 ? (
          <View style={styles.card}>
            <Text allowFontScaling style={styles.emptyText}>
              Nothing was scheduled this day.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {selectedRows.map((row, i) => (
              <DoseRow
                key={row.id}
                row={row}
                status={effectiveStatus(row, now)}
                canCorrect={row.scheduledAt <= now}
                divider={i < selectedRows.length - 1}
                onCorrect={() => handleCorrect(row)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function DoseRow({
  row,
  status,
  canCorrect,
  divider,
  onCorrect,
}: {
  row: HistoryOccurrenceRow;
  status: EffectiveStatus;
  canCorrect: boolean;
  divider: boolean;
  onCorrect: () => void;
}) {
  const medication = row.regimen.medication;
  const form = medication.form as MedicationForm;
  return (
    <View style={[styles.doseRow, divider && styles.doseRowDivider]}>
      <View style={styles.doseMain}>
        <View style={[styles.iconTile, { backgroundColor: medication.colorTag }]}>
          <FormIcon form={form} size={26} color={iconColorOn(medication.colorTag)} />
        </View>
        <View style={styles.doseText}>
          <Text allowFontScaling style={styles.doseName}>
            {medication.name}
          </Text>
          <Text allowFontScaling style={styles.doseMeta}>
            {formatTime(row.scheduledAt)}
            {medication.doseAmount
              ? ` · ${medication.doseAmount} ${medication.doseUnit ?? ""}`
              : ""}
          </Text>
        </View>
        <StatusPill status={status} />
      </View>
      {doseActivity(row).map((activity) => (
        <Text key={activity.kind} allowFontScaling style={styles.activityText}>
          {describeActivity(activity, row.scheduledAt)}
        </Text>
      ))}
      {canCorrect && (
        <Pressable onPress={onCorrect} style={styles.correctButton}>
          <Text allowFontScaling style={styles.correctText}>
            Correct this dose
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Chevron({ direction, color }: { direction: "left" | "right"; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d={direction === "left" ? "M15 5 L8 12 L15 19" : "M9 5 L16 12 L9 19"}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.background,
  },
  main: {
    gap: 16,
    padding: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: -12,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: light.text,
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekButton: {
    width: 48,
    height: 48,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: brand.fjord,
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  weekButtonDisabled: {
    borderColor: brand.frost,
    backgroundColor: light.background,
  },
  rangeText: {
    fontSize: typography.bodyMinSp,
    fontWeight: "600",
    color: light.text,
  },
  weekStrip: {
    flexDirection: "row",
    backgroundColor: light.surface,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayCellSelected: {
    borderColor: brand.deep,
    backgroundColor: light.background,
  },
  dayLetter: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
  },
  dayNumber: {
    fontSize: typography.bodyMinSp,
    fontWeight: "700",
    color: light.text,
  },
  dotPlaceholder: {
    width: 30,
    height: 30,
  },
  dayCount: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
    fontVariant: ["tabular-nums"],
  },
  daySection: {
    gap: 10,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: light.text,
    flexShrink: 1,
  },
  dayHeaderCount: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
  },
  card: {
    backgroundColor: light.surface,
    borderRadius: radii.card,
    padding: 14,
  },
  emptyText: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
  },
  doseRow: {
    gap: 12,
    paddingVertical: 10,
  },
  doseRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: light.background,
  },
  doseMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  doseText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  doseName: {
    fontSize: 19,
    fontWeight: "600",
    color: light.text,
  },
  doseMeta: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
    fontVariant: ["tabular-nums"],
  },
  activityText: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
    fontVariant: ["tabular-nums"],
    marginTop: -4,
  },
  correctButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: brand.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  correctText: {
    fontSize: typography.bodyMinSp,
    fontWeight: "600",
    color: brand.deep,
  },
});
