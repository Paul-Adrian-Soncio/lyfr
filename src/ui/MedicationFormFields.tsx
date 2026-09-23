// Shared form body for add-medication and edit-medication — photo, name,
// form picker, dose stepper, colour tag. Extracted so both screens change
// together; the header/footer/save-vs-archive actions stay per-screen since
// those differ.

import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
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

export interface MedicationFormState {
  photoPath: string | null;
  name: string;
  form: MedicationForm;
  doseAmount: number;
  colorTag: string;
}

interface MedicationFormFieldsProps {
  state: MedicationFormState;
  onChange: (next: MedicationFormState) => void;
  /** Rendered above the photo button — e.g. an Archive button on the edit screen. */
  headerExtra?: React.ReactNode;
}

export function MedicationFormFields({ state, onChange, headerExtra }: MedicationFormFieldsProps) {
  async function handleTakePhoto() {
    const path = await captureMedicationPhoto();
    if (path) onChange({ ...state, photoPath: path });
  }

  return (
    <ScrollView contentContainerStyle={styles.form}>
      {headerExtra}

      <Pressable style={styles.photoButton} onPress={handleTakePhoto}>
        {state.photoPath ? (
          <Image
            source={{ uri: resolveMedicationPhotoUri(state.photoPath) }}
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
          value={state.name}
          onChangeText={(name) => onChange({ ...state, name })}
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
            const selected = f === state.form;
            return (
              <Pressable
                key={f}
                onPress={() => onChange({ ...state, form: f })}
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
              onPress={() => onChange({ ...state, doseAmount: Math.max(0.5, state.doseAmount - 0.5) })}
              style={styles.stepperButton}
              hitSlop={8}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M6 12 H18" stroke={brand.deep} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Text allowFontScaling style={styles.stepperValue}>
              {state.doseAmount}
            </Text>
            <Pressable
              onPress={() => onChange({ ...state, doseAmount: state.doseAmount + 0.5 })}
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
            {formMeta[state.form].doseUnit}
          </Text>
        </View>
      </View>

      <View style={styles.field}>
        <Text allowFontScaling style={styles.label}>
          Colour tag
        </Text>
        <View style={styles.tagGrid}>
          {medicationTags.map((tag) => {
            const selected = tag === state.colorTag;
            return (
              <Pressable
                key={tag}
                onPress={() => onChange({ ...state, colorTag: tag })}
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
  );
}

const styles = StyleSheet.create({
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
});
