CREATE TABLE IF NOT EXISTS api_error_log (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  organisation_id TEXT,
  user_id TEXT,
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 500,
  error_name TEXT,
  error_message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_error_log_request ON api_error_log(request_id);
CREATE INDEX IF NOT EXISTS idx_api_error_log_product_created ON api_error_log(product_code,created_at DESC);
