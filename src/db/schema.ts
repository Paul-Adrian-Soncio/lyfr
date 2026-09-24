import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const medications = sqliteTable("medications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  form: text("form").notNull(),
  description: text("description"),
  colorTag: text("color_tag").notNull(),
  photoPath: text("photo_path"),
  doseAmount: text("dose_amount"),
  doseUnit: text("dose_unit"),
  notes: text("notes"),
  supplyRemaining: integer("supply_remaining"),
  supplyThreshold: integer("supply_threshold"),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch('subsec') * 1000)`),
});

export const regimens = sqliteTable("regimens", {
  id: text("id").primaryKey(),
  medicationId: text("medication_id")
    .notNull()
    .references(() => medications.id),
  ruleType: text("rule_type").notNull(),
  ruleConfig: text("rule_config", { mode: "json" }).notNull(),
  // Local calendar dates (YYYY-MM-DD), not epoch ms — see src/domain/regimen.ts.
  // A regimen's start/end is a calendar-day concept, not an instant.
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch('subsec') * 1000)`),
});

export const doseOccurrences = sqliteTable("dose_occurrences", {
  id: text("id").primaryKey(),
  regimenId: text("regimen_id")
    .notNull()
    .references(() => regimens.id),
  scheduledAt: integer("scheduled_at").notNull(),
  status: text("status").notNull(),
  acknowledgedAt: integer("acknowledged_at"),
  // Snoozes don't change status, so they'd otherwise leave no trace.
  // Shown in History alongside when the dose was taken.
  snoozeCount: integer("snooze_count").notNull().default(0),
  lastSnoozedAt: integer("last_snoozed_at"),
  actualNotificationId: text("actual_notification_id"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch('subsec') * 1000)`),
});

export const doseEdits = sqliteTable("dose_edits", {
  id: text("id").primaryKey(),
  occurrenceId: text("occurrence_id")
    .notNull()
    .references(() => doseOccurrences.id),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  previousTime: integer("previous_time"),
  newTime: integer("new_time"),
  editedAt: integer("edited_at").notNull().default(sql`(unixepoch('subsec') * 1000)`),
});

export const notificationLog = sqliteTable("notification_log", {
  id: text("id").primaryKey(),
  occurrenceId: text("occurrence_id")
    .notNull()
    .references(() => doseOccurrences.id),
  expectedFireAt: integer("expected_fire_at").notNull(),
  observedFireAt: integer("observed_fire_at"),
  channel: text("channel"),
  platform: text("platform").notNull(),
});

export const medicationsRelations = relations(medications, ({ many }) => ({
  regimens: many(regimens),
}));

export const regimensRelations = relations(regimens, ({ one, many }) => ({
  medication: one(medications, {
    fields: [regimens.medicationId],
    references: [medications.id],
  }),
  occurrences: many(doseOccurrences),
}));

export const doseOccurrencesRelations = relations(doseOccurrences, ({ one, many }) => ({
  regimen: one(regimens, {
    fields: [doseOccurrences.regimenId],
    references: [regimens.id],
  }),
  edits: many(doseEdits),
}));

export const doseEditsRelations = relations(doseEdits, ({ one }) => ({
  occurrence: one(doseOccurrences, {
    fields: [doseEdits.occurrenceId],
    references: [doseOccurrences.id],
  }),
}));
