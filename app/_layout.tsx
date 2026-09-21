import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { db } from "@/db/client";
import migrations from "@/db/migrations/migrations";
import { registerBackgroundHeartbeat } from "@/scheduling/backgroundHeartbeat";
import { reconcile } from "@/scheduling/heartbeat";
import { registerForegroundEventHandler } from "@/scheduling/notificationEvents";
import { ReliabilityBanner } from "@/ui/ReliabilityBanner";
import { useReliabilityStore } from "@/ui/reliabilityStore";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const setSuspectedMissCount = useReliabilityStore((s) => s.setSuspectedMissCount);

  // Reconciliation happens on launch, not at fire time — see CLAUDE.md §3
  // and src/scheduling/heartbeat.ts. Runs once migrations have applied.
  useEffect(() => {
    if (!success) return;
    reconcile().then((result) => {
      setSuspectedMissCount(result.suspectedMisses.length);
    });
    registerBackgroundHeartbeat();
    const unsubscribe = registerForegroundEventHandler();
    return unsubscribe;
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
