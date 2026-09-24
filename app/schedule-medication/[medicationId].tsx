// Schedule creation screen — "Step 2 of 2" after Add Medicine, per the
// mockup's AddMedication.dc.html footer ("Next: set schedule") and
// CLAUDE.md §6, which lists scheduling as a distinct feature area from the
// medication library. No mockup exists for this screen; visual language
// (cards, pills, stepper pattern) matches the rest of the app regardless.
//
// See CLAUDE.md §6 for V1 rule types: fixed daily times, specific weekdays,
// every N days, with a start date and optional end date.

import { eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/ui/Pressable";
import Svg, { Path } from "react-native-svg";
import { db } from "@/db/client";
import { medications, regimens } from "@/db/schema";
import type { Regimen } from "@/domain/regimen";
import { AndroidScheduler } from "@/scheduling/AndroidScheduler";
import {
  addDays,
  buildRuleFromState,
  ScheduleFormFields,
  type ScheduleFormState,
  toDateString,
} from "@/ui/ScheduleFormFields";
import { brand, light, radii, typography } from "@/theme/tokens";

export default function ScheduleMedicationScreen() {
  const { medicationId } = useLocalSearchParams<{ medicationId: string }>();
  const [medicationName, setMedicationName] = useState<string | null>(null);
  const [state, setState] = useState<ScheduleFormState>(() => ({
    ruleType: "fixed_daily",
    times: ["08:00"],
    weekdays: [1, 3, 5],
    intervalDays: 2,
    startDate: toDateString(new Date()),
    hasEndDate: false,
    endDate: addDays(toDateString(new Date()), 7),
  }));
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

  async function handleSave() {
    const rule = buildRuleFromState(state);
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
        startDate: state.startDate,
        endDate: state.hasEndDate ? state.endDate : null,
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

      <ScheduleFormFields
        state={state}
        onChange={setState}
        headerExtra={
          medicationName ? (
            <Text allowFontScaling style={styles.subtitle}>
              For {medicationName}
            </Text>
          ) : undefined
        }
      />

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
  subtitle: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
    marginBottom: -10,
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
