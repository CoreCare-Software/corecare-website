CREATE TABLE IF NOT EXISTS `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`automation_token` text NOT NULL,
	`request_type` text NOT NULL,
	`requester_name` text NOT NULL,
	`requester_email` text NOT NULL,
	`organisation_name` text DEFAULT '' NOT NULL,
	`relationship` text NOT NULL,
	`product_code` text,
	`request_summary` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`identity_status` text DEFAULT 'not_checked' NOT NULL,
	`received_at` text NOT NULL,
	`due_at` text NOT NULL,
	`extended_due_at` text,
	`completed_at` text,
	`assigned_to` text,
	`outcome_summary` text,
	`consent_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_privacy_requests_reference` ON `privacy_requests` (`reference`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_privacy_requests_automation_token` ON `privacy_requests` (`automation_token`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_privacy_requests_status_due` ON `privacy_requests` (`status`,`due_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_privacy_requests_email` ON `privacy_requests` (`requester_email`);
--> statement-breakpoint
PRAGMA optimize;
