import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Text, View } from "react-native";
import { db } from "@/db/client";
import migrations from "@/db/migrations/migrations";
import { AndroidScheduler } from "@/scheduling/AndroidScheduler";
import { registerBackgroundHeartbeat } from "@/scheduling/backgroundHeartbeat";
import { reconcile } from "@/scheduling/heartbeat";
import { registerForegroundEventHandler } from "@/scheduling/notificationEvents";
import { ReliabilityBanner } from "@/ui/ReliabilityBanner";
import { useReliabilityStore } from "@/ui/reliabilityStore";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const setSuspectedMissCount = useReliabilityStore((s) => s.setSuspectedMissCount);

  // On launch and every return to foreground: top reminders back up, then
  // reconcile expected against observed fires. CLAUDE.md §3 — refill on
  // every foreground and background wake, reconcile on launch rather than
  // at fire time. Runs once migrations have applied.
  useEffect(() => {
    if (!success) return;

    function checkIn() {
      AndroidScheduler.refillWindow().catch((e) => console.warn("refillWindow failed", e));
      reconcile().then((result) => setSuspectedMissCount(result.suspectedMisses.length));
    }

    checkIn();
    registerBackgroundHeartbeat();
    const unsubscribeEvents = registerForegroundEventHandler();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") checkIn();
    });
    return () => {
      unsubscribeEvents();
      appState.remove();
    };
  }, [success, setSuspectedMissCount]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text>Database migration failed: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <ReliabilityBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
