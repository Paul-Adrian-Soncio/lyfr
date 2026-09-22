// The missed-fire banner. See CLAUDE.md §3: "If fires are being missed,
// show a persistent banner: reminders may not be working on this device,
// with a button back into the battery settings walkthrough."

import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { doseStatus, typography } from "@/theme/tokens";
import { useReliabilityStore } from "./reliabilityStore";

export function ReliabilityBanner() {
  const suspectedMissCount = useReliabilityStore((s) => s.suspectedMissCount);

  if (suspectedMissCount === 0) return null;

  return (
    <View style={styles.banner}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
        <Path d="M12 6 V13" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        <Path d="M12 18 V18.1" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <Text allowFontScaling style={styles.text}>
        Reminders may not be working on this device.
      </Text>
      <Pressable onPress={() => router.push("/battery-walkthrough")}>
        <Text allowFontScaling style={styles.link}>
          Check settings
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: doseStatus.missed.fill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    color: "white",
    flex: 1,
    fontSize: typography.absoluteMinSp,
  },
  link: {
    color: "white",
    fontWeight: "700",
    textDecorationLine: "underline",
    fontSize: typography.absoluteMinSp,
  },
});
