SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME = 'login_phone'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE customers
     ADD COLUMN login_phone VARCHAR(30) NULL AFTER contact_phone,
     ADD COLUMN password_hash VARCHAR(128) NULL AFTER login_phone,
     ADD COLUMN password_updated_at DATETIME(6) NULL AFTER password_hash,
     ADD COLUMN register_source VARCHAR(30) NOT NULL DEFAULT ''ADMIN'' AFTER salesman_name,
     ADD COLUMN remark VARCHAR(500) NULL AFTER register_source,
     ADD COLUMN last_login_at DATETIME(6) NULL AFTER remark,
     ADD COLUMN disabled_reason VARCHAR(80) NULL AFTER last_login_at,
     ADD COLUMN disabled_remark VARCHAR(500) NULL AFTER disabled_reason,
     ADD COLUMN disabled_by VARCHAR(60) NULL AFTER disabled_remark,
     ADD COLUMN disabled_at DATETIME(6) NULL AFTER disabled_by,
     ADD COLUMN enabled_by VARCHAR(60) NULL AFTER disabled_at,
     ADD COLUMN enabled_at DATETIME(6) NULL AFTER enabled_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE customers
SET login_phone = contact_phone
WHERE login_phone IS NULL OR login_phone = '';

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND INDEX_NAME = 'idx_customers_login_phone'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE customers ADD KEY idx_customers_login_phone (login_phone)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  receiver_name VARCHAR(60) NOT NULL,
  receiver_phone VARCHAR(30) NOT NULL,
  region VARCHAR(120) NULL,
  detail_address VARCHAR(255) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_customer_addresses_customer_id (customer_id),
  CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_titles'
      AND COLUMN_NAME = 'customer_id'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_titles
     ADD COLUMN customer_id BIGINT NULL AFTER id,
     ADD COLUMN supported_invoice_types VARCHAR(120) NULL AFTER tax_no,
     ADD COLUMN default_invoice_type VARCHAR(40) NULL AFTER supported_invoice_types'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE invoice_titles it
LEFT JOIN customers c ON c.company_name = it.buyer_name OR c.contact_name = it.buyer_name
SET it.customer_id = c.id
WHERE it.customer_id IS NULL
  AND c.id IS NOT NULL;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_titles'
      AND INDEX_NAME = 'idx_invoice_titles_customer_id'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_titles ADD KEY idx_invoice_titles_customer_id (customer_id)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS customer_operation_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  operator_type VARCHAR(20) NOT NULL,
  operator_name VARCHAR(80) NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  action_content VARCHAR(500) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_customer_operation_logs_customer_id (customer_id),
  KEY idx_customer_operation_logs_created_at (created_at),
  CONSTRAINT fk_customer_operation_logs_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
