ALTER TABLE `trial_requests` ADD COLUMN `workspace_url` text;
--> statement-breakpoint
ALTER TABLE `trial_requests` ADD COLUMN `provisioning_status` text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE `trial_requests` ADD COLUMN `provisioning_error` text;
--> statement-breakpoint
ALTER TABLE `trial_requests` ADD COLUMN `activated_at` text;
--> statement-breakpoint
ALTER TABLE `trial_requests` ADD COLUMN `consent_version` text DEFAULT '2026-08-04' NOT NULL;
--> statement-breakpoint
ALTER TABLE `trial_requests` ADD COLUMN `source` text DEFAULT 'website' NOT NULL;
--> statement-breakpoint
ALTER TABLE `trial_requests` ADD COLUMN `last_notification_at` text;
--> statement-breakpoint
CREATE TABLE `contact_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`email` text NOT NULL,
	`contact_name` text NOT NULL,
	`company_name` text NOT NULL,
	`product_code` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_requests_reference` ON `contact_requests` (`reference`);
--> statement-breakpoint
CREATE INDEX `idx_contact_requests_status_created` ON `contact_requests` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_contact_requests_email` ON `contact_requests` (`email`);
--> statement-breakpoint
CREATE TABLE `form_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`product_code` text,
	`path` text DEFAULT '' NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_events_name_created` ON `analytics_events` (`event_name`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
