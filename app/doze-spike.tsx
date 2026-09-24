// Throwaway test screen. Not part of the app's real navigation or scope —
// exists only to prove Notifee's SET_EXACT_AND_ALLOW_WHILE_IDLE alarm
// actually survives Doze on the Samsung tablet, and that the resulting
// notification is audible on a locked screen, before the real
// AndroidScheduler is built on top of those assumptions. See STATE.md,
// "To verify, not assume". Delete once the Scheduler is built and proven.
//
// Screen-wake (turning the display on) was tried via SET_ALARM_CLOCK +
// AndroidCategory.ALARM + fullScreenAction + USE_FULL_SCREEN_INTENT and did
// not work on this Samsung tablet — likely OEM-suppressed, a known limitation
// for third-party apps on Samsung even with every relevant flag set. Not
// pursued further: CLAUDE.md §6 only requires a high-importance channel with
// alarm-category sound, which is what this now tests.

import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
} from "@notifee/react-native";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { light, typography } from "@/theme/tokens";

// Channel settings (sound, vibration, visibility) can't be changed after a
// channel is created — Android ignores updates silently. Bump this ID if
// testing changes to those settings, otherwise the old channel's config wins.
const CHANNEL_ID = "doze-spike-v4";

export default function DozeSpikeScreen() {
  const [log, setLog] = useState<string[]>([]);

  function append(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev]);
  }

  async function scheduleTestAlarm(minutesFromNow: number) {
    const settings = await notifee.requestPermission();
    append(`permission status: ${settings.authorizationStatus}`);

    await notifee.createChannel({
      id: CHANNEL_ID,
      name: "Doze spike test",
      importance: AndroidImportance.HIGH,
      sound: "default",
      vibration: true,
      visibility: AndroidVisibility.PUBLIC,
    });

    const fireAt = Date.now() + minutesFromNow * 60_000;

    const id = await notifee.createTriggerNotification(
      {
        title: "Doze spike test",
        body: `Expected to fire at ${new Date(fireAt).toLocaleTimeString()}`,
        android: {
          channelId: CHANNEL_ID,
          category: AndroidCategory.ALARM,
          pressAction: { id: "default" },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: fireAt,
        alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
      },
    );

    append(`scheduled id=${id} for ${new Date(fireAt).toLocaleTimeString()}`);
  }

  async function checkPending() {
    const ids = await notifee.getTriggerNotificationIds();
    append(`pending trigger notifications: ${ids.length}`);
  }

  return (
    <View style={styles.container}>
      <Text allowFontScaling style={styles.title}>
        Doze spike
      </Text>
      <Text allowFontScaling style={styles.body}>
        Schedule an exact alarm, then lock the tablet, turn the screen off, unplug it, and wait.
      </Text>
      <View style={styles.buttonRow}>
        <Button title="Schedule in 2 min" onPress={() => scheduleTestAlarm(2)} />
        <Button title="Schedule in 15 min" onPress={() => scheduleTestAlarm(15)} />
      </View>
      <Button title="Check pending count" onPress={checkPending} />
      {log.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: throwaway dev log; lines are plain text with no state.
        <Text allowFontScaling key={i} style={styles.logLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.background,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: typography.medicationNameMinSp,
    color: light.text,
    fontWeight: "600",
  },
  body: {
    fontSize: typography.bodyMinSp,
    color: light.text,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  logLine: {
    fontSize: typography.absoluteMinSp,
    color: light.text,
    fontFamily: "monospace",
  },
});
