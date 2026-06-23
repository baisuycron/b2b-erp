SET @sql := IF(
  (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND COLUMN_NAME = 'tax_no'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies ADD COLUMN tax_no VARCHAR(60) NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND COLUMN_NAME = 'receive_email'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies ADD COLUMN receive_email VARCHAR(120) NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND COLUMN_NAME = 'invoice_no'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies ADD COLUMN invoice_no VARCHAR(80) NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND COLUMN_NAME = 'reject_reason'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies ADD COLUMN reject_reason VARCHAR(500) NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND COLUMN_NAME = 'updated_at'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
