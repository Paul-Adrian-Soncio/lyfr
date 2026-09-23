// Edit medicine screen. See CLAUDE.md §6: "Edit and archive." Archiving
// never hard-deletes — see "Always true": "Medications are archived, never
// hard deleted. Adherence history depends on them existing."
//
// Confirmation on archive is resistant to accidental taps (§6, "Elderly UX
// baseline") via a native two-step Alert rather than a single tap.

import { eq } from "drizzle-orm";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { db } from "@/db/client";
import { medications } from "@/db/schema";
import { formMeta, type MedicationForm } from "@/domain/medication";
import { MedicationFormFields, type MedicationFormState } from "@/ui/MedicationFormFields";
import { brand, light, radii, typography } from "@/theme/tokens";

export default function EditMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<MedicationFormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.query.medications.findFirst({ where: eq(medications.id, id) }).then((row) => {
      if (!row) {
        Alert.alert("Not found", "This medicine no longer exists.");
        router.back();
        return;
      }
      setState({
        photoPath: row.photoPath,
        name: row.name,
        form: row.form as MedicationForm,
        doseAmount: row.doseAmount ? Number(row.doseAmount) : 1,
        colorTag: row.colorTag,
      });
    });
  }, [id]);

  async function handleSave() {
    if (!state) return;
    if (!state.name.trim()) {
      Alert.alert("Name required", "Enter the medicine's name before continuing.");
      return;
    }
    setSaving(true);
    try {
      await db
        .update(medications)
        .set({
          name: state.name.trim(),
          form: state.form,
          colorTag: state.colorTag,
          photoPath: state.photoPath,
          doseAmount: String(state.doseAmount),
          doseUnit: formMeta[state.form].doseUnit,
          updatedAt: Date.now(),
        })
        .where(eq(medications.id, id));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function handleArchivePress() {
    Alert.alert(
      "Archive this medicine?",
      `${state?.name ?? "This medicine"} will no longer appear in your list or schedule. Its history is kept.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", style: "destructive", onPress: handleArchiveConfirmed },
      ]
    );
  }

  async function handleArchiveConfirmed() {
    await db.update(medications).set({ archivedAt: Date.now() }).where(eq(medications.id, id));
    router.back();
  }

  if (!state) {
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
        </View>
      </View>
    );
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
          Edit medicine
        </Text>
        <Pressable onPress={handleArchivePress} hitSlop={8}>
          <Text allowFontScaling style={styles.archiveLink}>
            Archive
          </Text>
        </Pressable>
      </View>

      <MedicationFormFields state={state} onChange={setState} />

      <View style={styles.footer}>
        <Link href={{ pathname: "/edit-schedule/[medicationId]", params: { medicationId: id } }} asChild>
          <Pressable style={styles.editScheduleButton}>
            <Text allowFontScaling style={styles.editScheduleText}>
              Edit schedule
            </Text>
          </Pressable>
        </Link>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text allowFontScaling style={styles.saveButtonText}>
            {saving ? "Saving…" : "Save changes"}
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
  archiveLink: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9A4E06",
  },
  footer: {
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: brand.frost,
  },
  editScheduleButton: {
    height: 56,
    borderRadius: radii.buttonLarge,
    borderWidth: 2,
    borderColor: brand.fjord,
    alignItems: "center",
    justifyContent: "center",
  },
  editScheduleText: {
    fontSize: typography.bodyMinSp,
    fontWeight: "700",
    color: brand.deep,
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
