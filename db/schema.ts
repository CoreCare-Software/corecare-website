import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const trialRequests = sqliteTable("trial_requests", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  automationToken: text("automation_token"),
  email: text("email").notNull(),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name").notNull(),
  phone: text("phone").notNull().default(""),
  productCode: text("product_code").notNull(),
  teamSize: text("team_size").notNull().default(""),
  status: text("status").notNull().default("active"),
  trialStartedAt: text("trial_started_at").notNull(),
  trialEndsAt: text("trial_ends_at").notNull(),
  convertedAt: text("converted_at"),
  checkoutSessionId: text("checkout_session_id"),
  workspaceUrl: text("workspace_url"),
  provisioningStatus: text("provisioning_status").notNull().default("pending"),
  provisioningError: text("provisioning_error"),
  activatedAt: text("activated_at"),
  credentialsSetAt: text("credentials_set_at"),
  consentVersion: text("consent_version").notNull().default("2026-08-04"),
  source: text("source").notNull().default("website"),
  lastNotificationAt: text("last_notification_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_trial_requests_access_token").on(table.accessToken),
  uniqueIndex("idx_trial_requests_automation_token").on(table.automationToken),
  index("idx_trial_requests_email_product").on(table.email, table.productCode),
  index("idx_trial_requests_status_ends").on(table.status, table.trialEndsAt),
]);

export const contactRequests = sqliteTable("contact_requests", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(),
  automationToken: text("automation_token"),
  email: text("email").notNull(),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name").notNull(),
  productCode: text("product_code"),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  consentVersion: text("consent_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_contact_requests_reference").on(table.reference),
  uniqueIndex("idx_contact_requests_automation_token").on(table.automationToken),
  index("idx_contact_requests_status_created").on(table.status, table.createdAt),
  index("idx_contact_requests_email").on(table.email),
]);

export const formRateLimits = sqliteTable("form_rate_limits", {
  key: text("key").primaryKey(),
  requestCount: integer("request_count").notNull().default(0),
  windowStartedAt: text("window_started_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  eventName: text("event_name").notNull(),
  productCode: text("product_code"),
  path: text("path").notNull().default(""),
  outcome: text("outcome").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_analytics_events_name_created").on(table.eventName, table.createdAt)]);
