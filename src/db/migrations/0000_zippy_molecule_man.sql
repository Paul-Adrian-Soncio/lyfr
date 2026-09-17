CREATE TABLE `dose_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`occurrence_id` text NOT NULL,
	`previous_status` text NOT NULL,
	`new_status` text NOT NULL,
	`previous_time` integer,
	`new_time` integer,
	`edited_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`occurrence_id`) REFERENCES `dose_occurrences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dose_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`regimen_id` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`status` text NOT NULL,
	`acknowledged_at` integer,
	`actual_notification_id` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`regimen_id`) REFERENCES `regimens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`generic_name` text,
	`form` text NOT NULL,
	`description` text,
	`color_tag` text NOT NULL,
	`photo_path` text,
	`dose_amount` text,
	`dose_unit` text,
	`notes` text,
	`supply_remaining` integer,
	`supply_threshold` integer,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`occurrence_id` text NOT NULL,
	`expected_fire_at` integer NOT NULL,
	`observed_fire_at` integer,
	`channel` text,
	`platform` text NOT NULL,
	FOREIGN KEY (`occurrence_id`) REFERENCES `dose_occurrences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `regimens` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`rule_type` text NOT NULL,
	`rule_config` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
