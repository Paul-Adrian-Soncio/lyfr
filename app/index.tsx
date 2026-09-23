// Today view — the app's home screen. Matches the mockup's Main.dc.html:
// header with logo, date, add button; a progress summary; a hero "Next
// dose" card with Taken/Snooze/Skip; a "Later today" list for the rest.
//
// See CLAUDE.md §1: recognition beats reading — photo, form icon and
// colour tag are shown together, never one as a fallback for another (see
// STATE.md for the medications-list bug this exact mistake caused before).

import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { formMeta, type MedicationForm } from "@/domain/medication";
import { resolveMedicationPhotoUri } from "@/domain/medicationPhoto";
import { markSkipped, markTaken, snooze } from "@/scheduling/doseActions";
import { mapTodayOccurrences, todayOccurrencesQuery } from "@/scheduling/todayOccurrences";
import { FormIcon } from "@/ui/FormIcon";
import { LyfrLogo } from "@/ui/LyfrLogo";
import { brand, light, radii, typography } from "@/theme/tokens";

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export default function TodayScreen() {
  const { data } = useLiveQuery(todayOccurrencesQuery());
  const occurrences = mapTodayOccurrences(data ?? []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const takenCount = occurrences.filter((o) => o.status === "taken" || o.status === "skipped").length;
  const total = occurrences.length;
  const upcoming = occurrences.filter((o) => o.status === "upcoming");
  const next = upcoming[0];
  const later = upcoming.slice(1);

  async function runAction(id: string, action: "taken" | "snooze" | "skip") {
    setBusyId(id);
    try {
      if (action === "taken") await markTaken(id);
      else if (action === "skip") await markSkipped(id);
      else await snooze(id);
    } catch (e) {
      Alert.alert("Couldn't update", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  function handleAction(occurrence: ReturnType<typeof mapTodayOccurrences>[number], action: "taken" | "snooze" | "skip") {
    // "Taken" ahead of the scheduled time is allowed — someone may
    // genuinely take a dose early — but confirmed explicitly rather than
    // silently accepted, since a stray tap on the wrong card would
    // otherwise misrecord a dose with no prompt at all.
    if (action === "taken" && Date.now() < occurrence.scheduledAt) {
      Alert.alert(
        "Mark as taken early?",
        `This dose is scheduled for ${formatTime(occurrence.scheduledAt)}. Confirm you've already taken it.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes, taken", onPress: () => runAction(occurrence.id, action) },
        ]
      );
      return;
    }
    runAction(occurrence.id, action);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <LyfrLogo size={36} />
              <Text allowFontScaling style={styles.wordmark}>
                lyfr
              </Text>
            </View>
            <Link href="/add-medication" style={styles.addButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5 V19 M5 12 H19" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </Link>
          </View>

          <View>
            <Text allowFontScaling style={styles.title}>
              Today
            </Text>
            <Text allowFontScaling style={styles.dateText}>
              {formatDate(new Date())}
            </Text>
          </View>

          {total > 0 && (
            <View style={styles.progressBlock}>
              <View style={styles.progressLabelRow}>
                <Text allowFontScaling style={styles.progressLabel}>
                  {takenCount} of {total} taken
                </Text>
                <Text allowFontScaling style={styles.progressSubLabel}>
                  {total - takenCount} to go
                </Text>
              </View>
              <View style={styles.progressBar}>
                {occurrences.map((o) => (
                  <View
                    key={o.id}
                    style={[
                      styles.progressSegment,
                      o.status === "taken" || o.status === "skipped"
                        ? styles.progressSegmentFilled
                        : styles.progressSegmentEmpty,
                    ]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {next ? (
          <NextDoseCard
            occurrence={next}
            busy={busyId === next.id}
            onAction={(action) => handleAction(next, action)}
          />
        ) : total > 0 ? (
          <View style={styles.doneCard}>
            <Text allowFontScaling style={styles.doneText}>
              All doses accounted for today.
            </Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text allowFontScaling style={styles.emptyText}>
              No medicines scheduled yet.
            </Text>
            <Link href="/add-medication">
              <Text allowFontScaling style={styles.emptyLink}>
                Add your first medicine
              </Text>
            </Link>
          </View>
        )}

        {later.length > 0 && (
          <View style={styles.laterSection}>
            <Text allowFontScaling style={styles.laterTitle}>
              Later today
            </Text>
            {later.map((o) => (
              <LaterRow key={o.id} occurrence={o} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.devLinks}>
        <Link href="/medications">
          <Text allowFontScaling style={styles.devLink}>
            Medicines
          </Text>
        </Link>
        <Link href="/doze-spike">
          <Text allowFontScaling style={styles.devLink}>
            Doze spike (dev)
          </Text>
        </Link>
        <Link href="/scheduler-spike">
          <Text allowFontScaling style={styles.devLink}>
            Scheduler spike (dev)
          </Text>
        </Link>
        <Link href="/battery-walkthrough">
          <Text allowFontScaling style={styles.devLink}>
            Battery walkthrough (dev)
          </Text>
        </Link>
      </View>
    </View>
  );
}

function NextDoseCard({
  occurrence,
  busy,
  onAction,
}: {
  occurrence: ReturnType<typeof mapTodayOccurrences>[number];
  busy: boolean;
  onAction: (action: "taken" | "snooze" | "skip") => void;
}) {
  const form = occurrence.form as MedicationForm;
  const meta = formMeta[form];

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTimeRow}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 7.5 V12 l3 2 M12 12 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0"
            stroke={brand.frost}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text allowFontScaling style={styles.heroTimeText}>
          Next · {formatTime(occurrence.scheduledAt)}
        </Text>
      </View>

      <View style={styles.heroContentRow}>
        {occurrence.photoPath ? (
          <Image
            source={{ uri: resolveMedicationPhotoUri(occurrence.photoPath) }}
            style={styles.heroPhoto}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.heroPhoto, styles.heroIconTile, { backgroundColor: occurrence.colorTag }]}>
            <FormIcon form={form} size={36} color={brand.woad} />
          </View>
        )}
        <View style={styles.heroTextColumn}>
          <Text allowFontScaling style={styles.heroName}>
            {occurrence.medicationName}
          </Text>
          <Text allowFontScaling style={styles.heroDose}>
            {occurrence.doseAmount} {occurrence.doseUnit ?? meta.doseUnit}
          </Text>
          {occurrence.description && (
            <Text allowFontScaling style={styles.heroDescription}>
              {occurrence.description}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.heroActions}>
        <Pressable
          style={styles.takenButton}
          onPress={() => onAction("taken")}
          disabled={busy}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12.5 l4.5 4.5 L19 7.5"
              stroke={brand.deep}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text allowFontScaling style={styles.takenButtonText}>
            Taken
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => onAction("snooze")} disabled={busy}>
          <Text allowFontScaling style={styles.secondaryButtonText}>
            Snooze
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => onAction("skip")} disabled={busy}>
          <Text allowFontScaling style={styles.secondaryButtonText}>
            Skip
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LaterRow({ occurrence }: { occurrence: ReturnType<typeof mapTodayOccurrences>[number] }) {
  const form = occurrence.form as MedicationForm;
  const meta = formMeta[form];

  return (
    <View style={styles.laterCard}>
      <View style={[styles.laterIconTile, { backgroundColor: occurrence.colorTag }]}>
        <FormIcon form={form} size={26} color="#FFFFFF" />
      </View>
      <View style={styles.laterTextColumn}>
        <Text allowFontScaling style={styles.laterName}>
          {occurrence.medicationName}
        </Text>
        <Text allowFontScaling style={styles.laterDose}>
          {occurrence.doseAmount} {occurrence.doseUnit ?? meta.doseUnit}
        </Text>
      </View>
      <View style={styles.laterTimePill}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 7.5 V12 l3 2 M12 12 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0"
            stroke="#5B6B78"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text allowFontScaling style={styles.laterTimeText}>
          {formatTime(occurrence.scheduledAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.background,
  },
  main: {
    gap: 20,
    padding: 20,
    paddingBottom: 16,
  },
  header: {
    gap: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  wordmark: {
    fontFamily: typography.wordmarkFontFamily,
    fontWeight: "700",
    fontSize: 24,
    color: brand.deep,
    letterSpacing: -0.5,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: brand.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: light.text,
  },
  dateText: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
  },
  progressBlock: {
    gap: 8,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  progressLabel: {
    fontSize: typography.bodyMinSp,
    fontWeight: "600",
    color: light.text,
  },
  progressSubLabel: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
  },
  progressBar: {
    flexDirection: "row",
    gap: 4,
  },
  progressSegment: {
    flexGrow: 1,
    height: 10,
    borderRadius: 5,
  },
  progressSegmentFilled: {
    backgroundColor: brand.deep,
  },
  progressSegmentEmpty: {
    borderWidth: 2,
    borderColor: "#5B6B78",
  },
  heroCard: {
    backgroundColor: brand.deep,
    borderRadius: radii.cardLarge,
    padding: 20,
    gap: 16,
  },
  heroTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroTimeText: {
    fontSize: typography.absoluteMinSp,
    fontWeight: "600",
    color: brand.frost,
  },
  heroContentRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  heroPhoto: {
    width: 96,
    height: 96,
    borderRadius: 16,
  },
  heroIconTile: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextColumn: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  heroName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroDose: {
    fontSize: typography.bodyMinSp,
    color: "#E6EDF4",
  },
  heroDescription: {
    fontSize: typography.absoluteMinSp,
    color: brand.frost,
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
  },
  takenButton: {
    flex: 2,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  takenButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: brand.deep,
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: brand.fjord,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  doneCard: {
    backgroundColor: light.surface,
    borderRadius: radii.cardLarge,
    padding: 24,
    alignItems: "center",
  },
  doneText: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
  },
  emptyCard: {
    backgroundColor: light.surface,
    borderRadius: radii.cardLarge,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
  },
  emptyLink: {
    fontSize: typography.bodyMinSp,
    fontWeight: "700",
    color: brand.deep,
  },
  laterSection: {
    gap: 10,
  },
  laterTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: light.text,
  },
  laterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: light.surface,
    borderRadius: radii.card,
    padding: 12,
  },
  laterIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  laterTextColumn: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  laterName: {
    fontSize: 19,
    fontWeight: "600",
    color: light.text,
  },
  laterDose: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
  },
  laterTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: "#5B6B78",
    borderRadius: radii.pill,
  },
  laterTimeText: {
    fontSize: typography.absoluteMinSp,
    fontWeight: "600",
    color: light.textMuted,
  },
  devLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 12,
    justifyContent: "center",
  },
  devLink: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
    textDecorationLine: "underline",
  },
});
