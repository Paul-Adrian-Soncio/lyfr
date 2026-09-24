ALTER TABLE `dose_occurrences` ADD `snooze_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `dose_occurrences` ADD `last_snoozed_at` integer;