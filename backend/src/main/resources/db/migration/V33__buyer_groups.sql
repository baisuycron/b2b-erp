CREATE TABLE IF NOT EXISTS buyer_groups (
  id BIGINT NOT NULL AUTO_INCREMENT,
  group_code VARCHAR(40) NOT NULL,
  group_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  sort_order INT NOT NULL DEFAULT 0,
  remark VARCHAR(500) NULL,
  created_by VARCHAR(60) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_by VARCHAR(60) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_buyer_groups_code (group_code),
  UNIQUE KEY uk_buyer_groups_name (group_name),
  KEY idx_buyer_groups_status_sort (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME = 'group_id'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE customers ADD COLUMN group_id BIGINT NULL AFTER customer_code'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND INDEX_NAME = 'idx_customers_group_id'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE customers ADD KEY idx_customers_group_id (group_id)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME = 'fk_customers_buyer_group'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE customers ADD CONSTRAINT fk_customers_buyer_group FOREIGN KEY (group_id) REFERENCES buyer_groups (id)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE admin_roles
SET permission_json = JSON_ARRAY_APPEND(
  permission_json,
  '$', 'buyer:info',
  '$', 'buyer:info:view',
  '$', 'buyer:info:create',
  '$', 'buyer:info:update',
  '$', 'buyer:info:disable',
  '$', 'buyer:info:reset-password',
  '$', 'buyer:info:export'
)
WHERE JSON_VALID(permission_json)
  AND JSON_CONTAINS(permission_json, JSON_QUOTE('buyer'), '$')
  AND NOT JSON_CONTAINS(permission_json, JSON_QUOTE('buyer:info'), '$');
