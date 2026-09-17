// Throwaway test screen. Exists only to verify AndroidScheduler works
// end-to-end on-device — Crypto.randomUUID(), the SQL RETURNING clause, and
// real Notifee scheduling driven by generated occurrences — before any real
// UI depends on it. See STATE.md. Delete once medication library UI exists
// and exercises this path for real.

import { eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { db } from "@/db/client";
import { doseOccurrences, medications, regimens } from "@/db/schema";
import type { Regimen } from "@/domain/regimen";
import { AndroidScheduler } from "@/scheduling/AndroidScheduler";
import { light, typography } from "@/theme/tokens";

export default function SchedulerSpikeScreen() {
  const [log, setLog] = useState<string[]>([]);

  function append(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev]);
  }

  async function runTest() {
    try {
      append(`Crypto.randomUUID() -> ${Crypto.randomUUID()}`);

      const medicationId = Crypto.randomUUID();
      await db.insert(medications).values({
        id: medicationId,
        name: "Scheduler spike test med",
        form: "tablet",
        colorTag: "#D55E00",
      });
      append(`inserted medication ${medicationId}`);

      const now = new Date();
      const inTwoMin = new Date(now.getTime() + 2 * 60_000);
      const time = `${String(inTwoMin.getHours()).padStart(2, "0")}:${String(
        inTwoMin.getMinutes()
      ).padStart(2, "0")}`;

      const regimenId = Crypto.randomUUID();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;

      const regimen: Regimen = {
        id: regimenId,
        medicationId,
        rule: { type: "fixed_daily", times: [time as `${number}:${number}`] },
        startDate: today,
        endDate: today,
        active: true,
      };

      await db.insert(regimens).values({
        id: regimen.id,
        medicationId: regimen.medicationId,
        ruleType: regimen.rule.type,
        ruleConfig: regimen.rule,
        startDate: regimen.startDate,
        endDate: regimen.endDate,
        active: regimen.active,
      });
      append(`inserted regimen ${regimenId}, fires at ${time} today`);

      await AndroidScheduler.syncRegimen(regimen);
      append("syncRegimen completed without throwing");

      const rows = await db.query.doseOccurrences.findMany({
        where: eq(doseOccurrences.regimenId, regimenId),
      });
      append(`dose_occurrences for this regimen: ${rows.length}`);
      for (const row of rows) {
        append(
          `  id=${row.id.slice(0, 8)} scheduledAt=${new Date(row.scheduledAt).toLocaleTimeString()} notifId=${row.actualNotificationId?.slice(0, 8)}`
        );
      }

      const pending = await AndroidScheduler.pendingCount();
      append(`AndroidScheduler.pendingCount() -> ${pending}`);
    } catch (e) {
      append(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <View style={styles.container}>
      <Text allowFontScaling style={styles.title}>
        Scheduler spike
      </Text>
      <Text allowFontScaling style={styles.body}>
        Creates a throwaway medication + regimen firing in ~2 minutes, syncs
        it through AndroidScheduler, and reports what happened.
      </Text>
      <Button title="Run test" onPress={runTest} />
      {log.map((line, i) => (
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
  logLine: {
    fontSize: typography.absoluteMinSp,
    color: light.text,
    fontFamily: "monospace",
  },
});
