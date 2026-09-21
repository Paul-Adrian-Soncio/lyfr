// The missed-fire banner. See CLAUDE.md §3: "If fires are being missed,
// show a persistent banner: reminders may not be working on this device,
// with a button back into the battery settings walkthrough."
//
// The button below calls Notifee's power-manager settings directly as a
// placeholder — replace with a link into the real walkthrough screen once
// that exists (STATE.md's next step after this one).

import notifee from "@notifee/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { doseStatus } from "@/theme/tokens";
import { useReliabilityStore } from "./reliabilityStore";

export function ReliabilityBanner() {
  const suspectedMissCount = useReliabilityStore((s) => s.suspectedMissCount);

  if (suspectedMissCount === 0) return null;

  return (
    <View style={styles.banner}>
      <Text allowFontScaling style={styles.icon}>
        !
      </Text>
      <Text allowFontScaling style={styles.text}>
        Reminders may not be working on this device.
      </Text>
      <Pressable onPress={() => notifee.openPowerManagerSettings()}>
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
    gap: 8,
    backgroundColor: doseStatus.missed.fill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  icon: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
  },
  text: {
    color: "white",
    flex: 1,
    fontSize: 16,
  },
  link: {
    color: "white",
    fontWeight: "700",
    textDecorationLine: "underline",
    fontSize: 16,
  },
});
