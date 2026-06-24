SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND COLUMN_NAME = 'invoice_type_source'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies
     ADD COLUMN invoice_type_source VARCHAR(40) NULL AFTER invoice_type,
     ADD COLUMN applicant_name VARCHAR(80) NULL AFTER buyer_name,
     ADD COLUMN buyer_remark VARCHAR(500) NULL AFTER receive_email,
     ADD COLUMN admin_remark VARCHAR(500) NULL AFTER buyer_remark,
     ADD COLUMN reject_remark VARCHAR(500) NULL AFTER reject_reason,
     ADD COLUMN rejected_by VARCHAR(60) NULL AFTER reject_remark,
     ADD COLUMN rejected_at DATETIME(6) NULL AFTER rejected_by,
     ADD COLUMN cancelled_reason VARCHAR(500) NULL AFTER rejected_at,
     ADD COLUMN cancelled_by VARCHAR(80) NULL AFTER cancelled_reason,
     ADD COLUMN cancelled_at DATETIME(6) NULL AFTER cancelled_by,
     ADD COLUMN confirmed_by VARCHAR(60) NULL AFTER cancelled_at,
     ADD COLUMN confirmed_at DATETIME(6) NULL AFTER confirmed_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_files'
      AND COLUMN_NAME = 'file_url'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_files
     ADD COLUMN file_url TEXT NULL AFTER file_name,
     ADD COLUMN file_content LONGTEXT NULL AFTER file_url,
     ADD COLUMN content_type VARCHAR(80) NULL AFTER file_content,
     ADD COLUMN invoice_code VARCHAR(80) NULL AFTER invoice_no,
     ADD COLUMN invoice_date DATE NULL AFTER invoice_code,
     ADD COLUMN uploaded_by VARCHAR(60) NULL AFTER invoice_amount,
     ADD COLUMN remark VARCHAR(500) NULL AFTER uploaded_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
