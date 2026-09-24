// Edit schedule screen. V1 assumes one active regimen per medication — the
// create flow (app/schedule-medication/[medicationId].tsx) only ever makes
// one, and CLAUDE.md §6 doesn't describe multiple concurrent regimens per
// medication. If that assumption ever needs to change (e.g. a taper with
// different rules over time), this screen's "load the regimen" step is
// where that would need to become a picker instead.
//
// Editing must cancel the OLD regimen's still-pending occurrences before
// re-syncing under the new rule — otherwise stale occurrences from the old
// schedule linger at "upcoming" forever alongside the new ones. See
// AndroidScheduler.cancelRegimen, which marks them "cancelled" rather than
// leaving them stuck (found while building this screen — see STATE.md).

import { and, eq } from "drizzle-orm";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/ui/Pressable";
import Svg, { Path } from "react-native-svg";
import { db } from "@/db/client";
import { medications, regimens } from "@/db/schema";
import type { Regimen, RuleConfig } from "@/domain/regimen";
import { AndroidScheduler } from "@/scheduling/AndroidScheduler";
import {
  buildRuleFromState,
  ScheduleFormFields,
  type ScheduleFormState,
} from "@/ui/ScheduleFormFields";
import { brand, light, radii, typography } from "@/theme/tokens";

function ruleToFormFields(rule: RuleConfig): Pick<ScheduleFormState, "ruleType" | "times" | "weekdays" | "intervalDays"> {
  if (rule.type === "fixed_daily") {
    return { ruleType: "fixed_daily", times: rule.times, weekdays: [1, 3, 5], intervalDays: 2 };
  }
  if (rule.type === "specific_weekdays") {
    return { ruleType: "specific_weekdays", times: rule.times, weekdays: rule.weekdays, intervalDays: 2 };
  }
  return { ruleType: "every_n_days", times: rule.times, weekdays: [1, 3, 5], intervalDays: rule.intervalDays };
}

export default function EditScheduleScreen() {
  const { medicationId } = useLocalSearchParams<{ medicationId: string }>();
  const [medicationName, setMedicationName] = useState<string | null>(null);
  const [regimenId, setRegimenId] = useState<string | null>(null);
  const [state, setState] = useState<ScheduleFormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const medication = await db.query.medications.findFirst({
        where: eq(medications.id, medicationId),
      });
      if (!medication) {
        Alert.alert("Not found", "This medicine no longer exists.");
        router.back();
        return;
      }
      setMedicationName(medication.name);

      const regimen = await db.query.regimens.findFirst({
        where: and(eq(regimens.medicationId, medicationId), eq(regimens.active, true)),
      });
      if (!regimen) {
        Alert.alert(
          "No schedule yet",
          "This medicine doesn't have a schedule set up. Add one from the medicine's edit screen."
        );
        router.back();
        return;
      }

      setRegimenId(regimen.id);
      setState({
        ...ruleToFormFields(regimen.ruleConfig as RuleConfig),
        startDate: regimen.startDate,
        hasEndDate: regimen.endDate != null,
        endDate: regimen.endDate ?? regimen.startDate,
      });
    }
    load();
  }, [medicationId]);

  async function handleSave() {
    if (!state || !regimenId) return;
    const rule = buildRuleFromState(state);
    if (!rule) {
      Alert.alert("Pick at least one day", "Choose which days this applies to.");
      return;
    }

    setSaving(true);
    try {
      // Cancel the old regimen's pending occurrences BEFORE changing the
      // rule — syncRegimen's idempotency is keyed on (regimenId,
      // scheduledAt), so a changed rule produces new scheduledAt values
      // that wouldn't collide with (and therefore wouldn't clean up) the
      // stale ones on their own.
      await AndroidScheduler.cancelRegimen(regimenId);

      const updatedRegimen: Regimen = {
        id: regimenId,
        medicationId,
        rule,
        startDate: state.startDate,
        endDate: state.hasEndDate ? state.endDate : null,
        active: true,
      };

      await db
        .update(regimens)
        .set({
          ruleType: updatedRegimen.rule.type,
          ruleConfig: updatedRegimen.rule,
          startDate: updatedRegimen.startDate,
          endDate: updatedRegimen.endDate,
          updatedAt: Date.now(),
        })
        .where(eq(regimens.id, regimenId));

      await AndroidScheduler.syncRegimen(updatedRegimen);

      router.dismissTo("/medications");
    } catch (e) {
      Alert.alert(
        "Couldn't update reminders",
        e instanceof Error ? e.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!state) {
    return <View style={styles.screen} />;
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
          Edit schedule
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
            {saving ? "Updating…" : "Save changes"}
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
