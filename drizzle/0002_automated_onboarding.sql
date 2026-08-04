ALTER TABLE `trial_requests` ADD COLUMN `automation_token` text;
--> statement-breakpoint
ALTER TABLE `trial_requests` ADD COLUMN `credentials_set_at` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trial_requests_automation_token` ON `trial_requests` (`automation_token`);
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD COLUMN `automation_token` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_requests_automation_token` ON `contact_requests` (`automation_token`);
