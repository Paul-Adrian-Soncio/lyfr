// Medicine library screen. See CLAUDE.md §6, "Medication library": add,
// edit, archive. This is the browse/list view — add lives at
// app/add-medication.tsx.
//
// Archived medications are hidden here but never deleted — see CLAUDE.md
// "Always true": "Medications are archived, never hard deleted. Adherence
// history depends on them existing."

import { desc, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { db } from "@/db/client";
import { medications } from "@/db/schema";
import { formMeta, type MedicationForm } from "@/domain/medication";
import { resolveMedicationPhotoUri } from "@/domain/medicationPhoto";
import { brand, light, radii, typography } from "@/theme/tokens";
import { FormIcon } from "@/ui/FormIcon";
import { Pressable } from "@/ui/Pressable";

export default function MedicationsScreen() {
  const { data } = useLiveQuery(
    db
      .select()
      .from(medications)
      .where(isNull(medications.archivedAt))
      .orderBy(desc(medications.createdAt)),
  );

  const rows = data ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text allowFontScaling style={styles.title}>
          Medicines
        </Text>
        <Link href="/add-medication" asChild>
          <Pressable style={styles.addButton}>
            <Text allowFontScaling style={styles.addButtonText}>
              + Add
            </Text>
          </Pressable>
        </Link>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text allowFontScaling style={styles.emptyText}>
            No medicines added yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MedicationRow medication={item} />}
        />
      )}
    </View>
  );
}

function MedicationRow({ medication }: { medication: typeof medications.$inferSelect }) {
  const form = medication.form as MedicationForm;
  const meta = formMeta[form];

  return (
    <Link href={{ pathname: "/edit-medication/[id]", params: { id: medication.id } }} asChild>
      <Pressable style={styles.card}>
        {medication.photoPath ? (
          <Image
            source={{ uri: resolveMedicationPhotoUri(medication.photoPath) }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.iconTile, { backgroundColor: medication.colorTag }]}>
            <FormIcon form={form} size={26} color={brand.woad} />
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardNameRow}>
            <View style={[styles.colorDot, { backgroundColor: medication.colorTag }]} />
            <Text allowFontScaling style={styles.cardName}>
              {medication.name}
            </Text>
          </View>
          <Text allowFontScaling style={styles.cardMeta}>
            {medication.doseAmount} {medication.doseUnit ?? meta.doseUnit} · {meta.label}
          </Text>
        </View>
      </Pressable>
    </Link>
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
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: light.text,
  },
  addButton: {
    backgroundColor: brand.deep,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: typography.absoluteMinSp,
    fontWeight: "700",
  },
  list: {
    padding: 20,
    paddingTop: 8,
    gap: 10,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: typography.bodyMinSp,
    color: light.textMuted,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: light.surface,
    borderRadius: radii.card,
    padding: 12,
  },
  photo: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cardName: {
    fontSize: 19,
    fontWeight: "600",
    color: light.text,
  },
  cardMeta: {
    fontSize: typography.absoluteMinSp,
    color: light.textMuted,
  },
});
