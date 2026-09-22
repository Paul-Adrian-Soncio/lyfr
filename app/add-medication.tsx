// Add medicine screen. See CLAUDE.md §6 (V1 scope: photo, name, generic
// name, form, form-driven dose unit, physical description, colour tag,
// notes, edit and archive — scheduling is a separate step, not built here
// yet) and §5 ("Medication form drives everything"). Matches the mockup's
// AddMedication.dc.html structure, extended to all 9 forms (see
// src/domain/medication.ts for the addition of "vitamin" and why patch/
// topical have no mockup reference).

import * as Crypto from "expo-crypto";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { db } from "@/db/client";
import { medications } from "@/db/schema";
import { formMeta, type MedicationForm } from "@/domain/medication";
import { captureMedicationPhoto, resolveMedicationPhotoUri } from "@/domain/medicationPhoto";
import { FormIcon } from "@/ui/FormIcon";
import { brand, light, medicationTags, radii, typography } from "@/theme/tokens";

const FORM_ORDER: MedicationForm[] = [
  "tablet",
  "capsule",
  "liquid",
  "injection",
  "drops",
  "inhaler",
  "patch",
  "topical",
  "vitamin",
];

export default function AddMedicationScreen() {
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [form, setForm] = useState<MedicationForm>("tablet");
  const [doseAmount, setDoseAmount] = useState(1);
  const [colorTag, setColorTag] = useState<string>(medicationTags[0]);
  const [saving, setSaving] = useState(false);

  async function handleTakePhoto() {
    const path = await captureMedicationPhoto();
    if (path) setPhotoPath(path);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter the medicine's name before continuing.");
      return;
    }
    setSaving(true);
    try {
      await db.insert(medications).values({
        id: Crypto.randomUUID(),
        name: name.trim(),
        form,
        colorTag,
        photoPath,
        doseAmount: String(doseAmount),
        doseUnit: formMeta[form].doseUnit,
      });
      router.back();
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
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Pressable style={styles.photoButton} onPress={handleTakePhoto}>
          {photoPath ? (
            <Image
              source={{ uri: resolveMedicationPhotoUri(photoPath) }}
              style={styles.photoPreview}
              contentFit="cover"
            />
          ) : (
            <>
              <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M3 8 h3.5 l2 -3 h7 l2 3 H21 V19 H3 z"
                  stroke={brand.deep}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M12 13 m-3.5 0 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0"
                  stroke={brand.deep}
                  strokeWidth={2}
                />
              </Svg>
              <Text allowFontScaling style={styles.photoButtonTitle}>
                Take a photo of the pack
              </Text>
              <Text allowFontScaling style={styles.photoButtonSubtitle}>
                Optional · makes it easier to recognise
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.field}>
          <Text allowFontScaling style={styles.label}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Metformin"
            allowFontScaling
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text allowFontScaling style={styles.label}>
            Form
          </Text>
          <View style={styles.formGrid}>
            {FORM_ORDER.map((f) => {
              const selected = f === form;
              return (
                <Pressable
                  key={f}
                  onPress={() => setForm(f)}
                  style={[styles.formButton, selected && styles.formButtonSelected]}
                >
                  <FormIcon form={f} size={20} color={selected ? "#FFFFFF" : brand.deep} />
                  <Text
                    allowFontScaling
                    style={[styles.formButtonText, selected && styles.formButtonTextSelected]}
                  >
                    {formMeta[f].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text allowFontScaling style={styles.label}>
            Dose
          </Text>
          <View style={styles.doseRow}>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setDoseAmount((n) => Math.max(0.5, n - 0.5))}
                style={styles.stepperButton}
                hitSlop={8}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 12 H18" stroke={brand.deep} strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              </Pressable>
              <Text allowFontScaling style={styles.stepperValue}>
                {doseAmount}
              </Text>
              <Pressable
                onPress={() => setDoseAmount((n) => n + 0.5)}
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
            <Text allowFontScaling style={styles.doseUnit}>
              {formMeta[form].doseUnit}
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text allowFontScaling style={styles.label}>
            Colour tag
          </Text>
          <View style={styles.tagGrid}>
            {medicationTags.map((tag) => {
              const selected = tag === colorTag;
              return (
                <Pressable
                  key={tag}
                  onPress={() => setColorTag(tag)}
                  style={[
                    styles.tagButton,
                    { backgroundColor: tag },
                    selected && styles.tagButtonSelected,
                  ]}
                >
                  {selected && (
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 12.5 l4.5 4.5 L19 7.5"
                        stroke={brand.woad}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text allowFontScaling style={styles.saveButtonText}>
            {saving ? "Saving…" : "Save medicine"}
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
  form: {
    gap: 14,
    padding: 20,
    paddingTop: 0,
  },
  photoButton: {
    height: 120,
    borderWidth: 2,
    borderColor: brand.sea,
    borderStyle: "dashed",
    borderRadius: 18,
    backgroundColor: light.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  photoButtonTitle: {
    fontSize: typography.bodyMinSp,
    fontWeight: "600",
    color: brand.deep,
  },
  photoButtonSubtitle: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: typography.absoluteMinSp,
    fontWeight: "600",
    color: light.text,
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderColor: "#5B6B78",
    borderRadius: radii.button,
    paddingHorizontal: 16,
    fontSize: 20,
    color: light.text,
    backgroundColor: light.surface,
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  formButton: {
    flexBasis: "31%",
    flexGrow: 1,
    height: 56,
    borderWidth: 2,
    borderColor: brand.fjord,
    borderRadius: radii.button,
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  formButtonSelected: {
    backgroundColor: brand.deep,
    borderColor: brand.deep,
  },
  formButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: light.text,
  },
  formButtonTextSelected: {
    color: "#FFFFFF",
  },
  doseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  stepperValue: {
    width: 64,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: light.text,
  },
  doseUnit: {
    fontSize: 20,
    color: light.text,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tagButton: {
    width: "22%",
    height: 48,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
  },
  tagButtonSelected: {
    borderWidth: 3,
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
