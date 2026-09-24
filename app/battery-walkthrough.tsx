// The Samsung battery walkthrough screen. See CLAUDE.md §8 and
// src/scheduling/batteryWalkthrough.ts for the checks this drives.
//
// Re-enterable by design — reachable from onboarding (not yet built) and
// from the reliability banner (src/ui/ReliabilityBanner.tsx) if the
// heartbeat later detects real misses. Does not assume it's only ever
// shown once.
//
// Visual language matches the mockup (project/Main.dc.html etc. in the
// design canvas) — see src/theme/tokens.ts for the extracted conventions:
// 16/24px card radii, 56/60px button heights, pill badges, Deep-fill
// primary buttons, Fjord-outline secondary buttons.

import { useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  checkDeviceSupport,
  type DeviceSupport,
  walkthroughSteps,
} from "@/scheduling/batteryWalkthrough";
import { brand, buttonHeights, light, radii, typography } from "@/theme/tokens";
import { LyfrLogo } from "@/ui/LyfrLogo";
import { Pressable } from "@/ui/Pressable";

type StepStatus = "unknown" | "satisfied" | "unsatisfied";

export default function BatteryWalkthroughScreen() {
  const [device, setDevice] = useState<DeviceSupport | null>(null);
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});

  const refreshStatuses = useCallback(async () => {
    const results = await Promise.all(
      walkthroughSteps.map(async (step) => {
        if (!step.checkable) return [step.id, "unknown"] as const;
        const satisfied = await step.isSatisfied();
        return [step.id, satisfied ? "satisfied" : "unsatisfied"] as const;
      }),
    );
    setStatuses(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    checkDeviceSupport().then(setDevice);
    refreshStatuses();
  }, [refreshStatuses]);

  // Re-check when the user comes back from a settings screen — this is the
  // "verify, don't just trust" step CLAUDE.md §8 asks for.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshStatuses();
    });
    return () => subscription.remove();
  }, [refreshStatuses]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <LyfrLogo size={36} />
        <Text allowFontScaling style={styles.wordmark}>
          lyfr
        </Text>
      </View>

      <View style={styles.scroll}>
        <Text allowFontScaling style={styles.title}>
          Keep reminders working
        </Text>
        <Text allowFontScaling style={styles.body}>
          {device?.manufacturer === "samsung"
            ? "Samsung phones sometimes stop apps from sending reminders to save battery. These steps tell your phone to leave Lyfr alone."
            : "These steps tell your phone to leave Lyfr alone so reminders keep working."}
        </Text>

        {walkthroughSteps.map((step) => {
          if (step.id === "oem-power-manager" && device && !device.oemStepAvailable) {
            return null;
          }
          const status = statuses[step.id] ?? "unknown";
          return (
            <View key={step.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <StatusBadge status={status} />
                <Text allowFontScaling style={styles.cardTitle}>
                  {step.title}
                </Text>
              </View>
              <Text allowFontScaling style={styles.cardDescription}>
                {step.description}
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => step.open()}>
                <Text allowFontScaling style={styles.primaryButtonText}>
                  Open settings
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === "satisfied") {
    return (
      <View style={[styles.badge, { backgroundColor: brand.deep }]}>
        <CheckIcon color="#FFFFFF" />
        <Text allowFontScaling style={styles.badgeText}>
          Done
        </Text>
      </View>
    );
  }
  if (status === "unsatisfied") {
    return (
      <View style={[styles.badge, { backgroundColor: "#9A4E06" }]}>
        <ExclamationIcon color="#FFFFFF" />
        <Text allowFontScaling style={styles.badgeText}>
          Needs attention
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeOutline]}>
      <Text allowFontScaling style={[styles.badgeText, styles.badgeTextMuted]}>
        Check manually
      </Text>
    </View>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5 l4.5 4.5 L19 7.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ExclamationIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 6 V13" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M12 18 V18.1" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  wordmark: {
    fontFamily: typography.wordmarkFontFamily,
    fontWeight: "700",
    fontSize: 24,
    color: brand.deep,
    letterSpacing: -0.5,
  },
  scroll: {
    flexGrow: 1,
    gap: 20,
    padding: 20,
    paddingTop: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: light.text,
    lineHeight: 32 * 1.15,
  },
  body: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
  },
  card: {
    backgroundColor: light.surface,
    borderRadius: radii.card,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: typography.bodyMinSp,
    color: light.text,
    fontWeight: "700",
    flexShrink: 1,
  },
  cardDescription: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  badgeOutline: {
    borderWidth: 2,
    borderColor: "#5B6B78",
    backgroundColor: "transparent",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: typography.absoluteMinSp,
    fontWeight: "700",
  },
  badgeTextMuted: {
    color: light.textMuted,
  },
  primaryButton: {
    backgroundColor: brand.deep,
    height: buttonHeights.standard,
    borderRadius: radii.buttonLarge,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: typography.bodyMinSp,
    fontWeight: "700",
  },
});
