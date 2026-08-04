-- Authenticated support tickets submitted directly by connected CoreCare products.
ALTER TABLE platform_support_tickets ADD COLUMN requester_name TEXT;
ALTER TABLE platform_support_tickets ADD COLUMN requester_email TEXT;
ALTER TABLE platform_support_tickets ADD COLUMN external_reference TEXT;
ALTER TABLE platform_support_tickets ADD COLUMN source_product TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_ticket_external_reference
  ON platform_support_tickets(source_product, external_reference)
  WHERE external_reference IS NOT NULL;
