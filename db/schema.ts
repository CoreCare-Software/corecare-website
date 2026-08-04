import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const trialRequests = sqliteTable("trial_requests", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
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
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_trial_requests_access_token").on(table.accessToken),
  index("idx_trial_requests_email_product").on(table.email, table.productCode),
  index("idx_trial_requests_status_ends").on(table.status, table.trialEndsAt),
]);
