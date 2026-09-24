// Add medicine screen. See CLAUDE.md §6 (V1 scope: photo, name, generic
// name, form, form-driven dose unit, physical description, colour tag,
// notes, edit and archive — scheduling is a separate step, not built here
// yet) and §5 ("Medication form drives everything"). Matches the mockup's
// AddMedication.dc.html structure, extended to all 9 forms (see
// src/domain/medication.ts for the addition of "vitamin" and why patch/
// topical have no mockup reference).

import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { db } from "@/db/client";
import { medications } from "@/db/schema";
import { formMeta } from "@/domain/medication";
import { brand, light, medicationTags, radii } from "@/theme/tokens";
import { MedicationFormFields, type MedicationFormState } from "@/ui/MedicationFormFields";
import { Pressable } from "@/ui/Pressable";

export default function AddMedicationScreen() {
  const [state, setState] = useState<MedicationFormState>({
    photoPath: null,
    name: "",
    form: "tablet",
    doseAmount: 1,
    colorTag: medicationTags[0],
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!state.name.trim()) {
      Alert.alert("Name required", "Enter the medicine's name before continuing.");
      return;
    }
    setSaving(true);
    try {
      const id = Crypto.randomUUID();
      await db.insert(medications).values({
        id,
        name: state.name.trim(),
        form: state.form,
        colorTag: state.colorTag,
        photoPath: state.photoPath,
        doseAmount: String(state.doseAmount),
        doseUnit: formMeta[state.form].doseUnit,
      });
      router.push({
        pathname: "/schedule-medication/[medicationId]",
        params: { medicationId: id },
      });
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
          Add medicine
        </Text>
        <Text allowFontScaling style={styles.stepLabel}>
          Step 1 of 2
        </Text>
      </View>

      <MedicationFormFields state={state} onChange={setState} />

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text allowFontScaling style={styles.saveButtonText}>
            {saving ? "Saving…" : "Next: set schedule"}
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
    fontSize: 16,
    color: light.textMuted,
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
