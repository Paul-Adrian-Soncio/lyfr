// Custom time picker: stepper buttons, not a scroll/drag wheel. Chosen over
// a dial deliberately — discrete taps are more reliable than a drag gesture
// for users with reduced dexterity or tremor (see CLAUDE.md's open question
// on this, and §6's elderly UX baseline: oversized touch targets, tabular
// numerals, no fussy interactions). Reuses the same +/- stepper pattern as
// the dose-amount picker (src/ui/MedicationFormFields.tsx) for consistency.
//
// Usability bar to hold this to, per the native Android/iOS time picker it's
// replacing: unambiguous large targets, a separate equally-large AM/PM
// control (not buried in a wheel), and tabular numerals so digits don't
// shift width as they change. Revisit the native picker if any of this
// turns out not to hold up in practice — see STATE.md.

import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/ui/Pressable";
import Svg, { Path } from "react-native-svg";
import type { LocalTime } from "@/domain/regimen";
import { brand, light, radii } from "@/theme/tokens";

interface TimeStepperProps {
  value: LocalTime;
  onChange: (value: LocalTime) => void;
}

function parse24h(value: LocalTime): { hour24: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return { hour24: h, minute: m };
}

function format24h(hour24: number, minute: number): LocalTime {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}` as LocalTime;
}

function to12h(hour24: number): { hour12: number; isPm: boolean } {
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, isPm };
}

function from12h(hour12: number, isPm: boolean): number {
  const base = hour12 % 12;
  return isPm ? base + 12 : base;
}

export function TimeStepper({ value, onChange }: TimeStepperProps) {
  const { hour24, minute } = parse24h(value);
  const { hour12, isPm } = to12h(hour24);

  function stepHour(delta: number) {
    const nextHour12 = ((hour12 - 1 + delta + 12) % 12) + 1;
    onChange(format24h(from12h(nextHour12, isPm), minute));
  }

  function stepMinute(delta: number) {
    // Steps by 5 — fine enough for dose timing, coarse enough that a tap
    // makes visible progress rather than needing 60 taps to go round once.
    const next = (((minute + delta * 5) % 60) + 60) % 60;
    onChange(format24h(hour24, next));
  }

  function togglePeriod() {
    onChange(format24h(from12h(hour12, !isPm), minute));
  }

  return (
    <View style={styles.row}>
      <NumberStepper label="Hour" value={hour12} onDecrement={() => stepHour(-1)} onIncrement={() => stepHour(1)} />
      <Text allowFontScaling style={styles.colon}>
        :
      </Text>
      <NumberStepper
        label="Minute"
        value={minute}
        format={(n) => String(n).padStart(2, "0")}
        onDecrement={() => stepMinute(-1)}
        onIncrement={() => stepMinute(1)}
      />
      <Pressable
        onPress={togglePeriod}
        style={styles.periodToggle}
        accessibilityLabel={`Switch to ${isPm ? "AM" : "PM"}`}
      >
        <Text allowFontScaling style={styles.periodText}>
          {isPm ? "PM" : "AM"}
        </Text>
      </Pressable>
    </View>
  );
}

interface NumberStepperProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  onDecrement: () => void;
  onIncrement: () => void;
}

function NumberStepper({ label, value, format, onDecrement, onIncrement }: NumberStepperProps) {
  return (
    <View style={styles.stepperColumn}>
      <Pressable onPress={onIncrement} style={styles.stepperButton} accessibilityLabel={`Increase ${label}`}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5 V19 M5 12 H19" stroke={brand.deep} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Pressable>
      <Text allowFontScaling style={styles.stepperValue}>
        {format ? format(value) : value}
      </Text>
      <Pressable onPress={onDecrement} style={styles.stepperButton} accessibilityLabel={`Decrease ${label}`}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M6 12 H18" stroke={brand.deep} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperColumn: {
    alignItems: "center",
    gap: 6,
  },
  stepperButton: {
    width: 56,
    height: 48,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: brand.fjord,
    backgroundColor: light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 32,
    fontWeight: "700",
    color: light.text,
    fontVariant: ["tabular-nums"],
    minWidth: 56,
    textAlign: "center",
  },
  colon: {
    fontSize: 32,
    fontWeight: "700",
    color: light.text,
  },
  periodToggle: {
    width: 64,
    height: 56,
    borderRadius: radii.button,
    backgroundColor: brand.deep,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  periodText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
