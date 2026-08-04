CREATE TABLE `trial_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`email` text NOT NULL,
	`contact_name` text NOT NULL,
	`company_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`product_code` text NOT NULL,
	`team_size` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`trial_started_at` text NOT NULL,
	`trial_ends_at` text NOT NULL,
	`converted_at` text,
	`checkout_session_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trial_requests_access_token` ON `trial_requests` (`access_token`);
--> statement-breakpoint
CREATE INDEX `idx_trial_requests_email_product` ON `trial_requests` (`email`,`product_code`);
--> statement-breakpoint
CREATE INDEX `idx_trial_requests_status_ends` ON `trial_requests` (`status`,`trial_ends_at`);
--> statement-breakpoint
PRAGMA optimize;
