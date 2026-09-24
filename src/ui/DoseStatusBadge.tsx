// Dose status visuals from CLAUDE.md §7: taken = solid Deep + check,
// upcoming = outline + clock, missed = solid amber + exclamation (never
// red), skipped = solid slate + minus. Always colour plus icon plus text —
// never colour alone ("Always true" in CLAUDE.md). Icon paths match the
// mockup's History.dc.html.

import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { EffectiveStatus } from "@/domain/doseStatus";
import { doseStatus, radii, typography } from "@/theme/tokens";

const LABELS: Record<EffectiveStatus, string> = {
  taken: "Taken",
  upcoming: "Upcoming",
  missed: "Missed",
  skipped: "Skipped",
};

function colorFor(status: EffectiveStatus): string {
  return status === "upcoming" ? doseStatus.upcoming.outline : doseStatus[status].fill;
}

export function StatusIcon({
  status,
  size = 16,
  color,
}: {
  status: EffectiveStatus;
  size?: number;
  color: string;
}) {
  const stroke = {
    stroke: color,
    strokeWidth: status === "upcoming" ? 2.5 : 3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {status === "taken" && <Path d="M5 12.5 l4.5 4.5 L19 7.5" {...stroke} />}
      {status === "upcoming" && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M12 7.5 V12 l3 2" {...stroke} />
        </>
      )}
      {status === "missed" && (
        <>
          <Path d="M12 6 V13" {...stroke} />
          <Path d="M12 18 V18.1" {...stroke} />
        </>
      )}
      {status === "skipped" && <Path d="M6 12 H18" {...stroke} />}
    </Svg>
  );
}

/** A 30px round marker, as used per day in the week strip. */
export function StatusDot({ status }: { status: EffectiveStatus }) {
  const outlined = status === "upcoming";
  const color = colorFor(status);
  return (
    <View
      style={[
        styles.dot,
        outlined ? { borderWidth: 2, borderColor: color } : { backgroundColor: color },
      ]}
    >
      <StatusIcon status={status} color={outlined ? color : "#FFFFFF"} />
    </View>
  );
}

/** Icon plus label pill, as used on each dose row. */
export function StatusPill({ status }: { status: EffectiveStatus }) {
  const outlined = status === "upcoming";
  const color = colorFor(status);
  return (
    <View
      style={[
        styles.pill,
        outlined ? { borderWidth: 2, borderColor: color } : { backgroundColor: color },
      ]}
    >
      <StatusIcon status={status} color={outlined ? color : "#FFFFFF"} />
      <Text allowFontScaling style={[styles.pillText, { color: outlined ? "#3D5163" : "#FFFFFF" }]}>
        {LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pillText: {
    fontSize: typography.absoluteMinSp,
    fontWeight: "700",
  },
});
