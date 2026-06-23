SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sales_orders'
      AND COLUMN_NAME = 'refunded_amount'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE sales_orders ADD COLUMN refunded_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER total_amount'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'after_sale_return_logistics'
      AND COLUMN_NAME = 'shipped_at'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE after_sale_return_logistics ADD COLUMN shipped_at DATETIME(6) NULL AFTER logistics_no'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'after_sale_orders'
      AND COLUMN_NAME = 'order_id'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE after_sale_orders
     ADD COLUMN order_id BIGINT NULL AFTER order_no,
     ADD COLUMN customer_id BIGINT NULL AFTER order_id,
     ADD COLUMN customer_phone VARCHAR(30) NULL AFTER buyer_name,
     ADD COLUMN product_id BIGINT NULL AFTER after_sale_type,
     ADD COLUMN product_image TEXT NULL AFTER product_name,
     ADD COLUMN sku_code VARCHAR(80) NULL AFTER product_image,
     ADD COLUMN sku_name VARCHAR(160) NULL AFTER sku_code,
     ADD COLUMN description TEXT NULL AFTER reason,
     ADD COLUMN apply_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER refund_amount,
     ADD COLUMN refundable_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER apply_amount,
     ADD COLUMN approved_amount DECIMAL(18,2) NULL AFTER refundable_amount,
     ADD COLUMN process_type VARCHAR(40) NULL AFTER approved_amount,
     ADD COLUMN need_return BOOLEAN NOT NULL DEFAULT false AFTER process_type,
     ADD COLUMN return_address VARCHAR(500) NULL AFTER need_return,
     ADD COLUMN reviewer_name VARCHAR(60) NULL AFTER audit_remark,
     ADD COLUMN reviewed_at DATETIME(6) NULL AFTER reviewer_name,
     ADD COLUMN reject_reason VARCHAR(500) NULL AFTER reviewed_at,
     ADD COLUMN received_quantity INT NULL AFTER reject_reason,
     ADD COLUMN receive_result VARCHAR(40) NULL AFTER received_quantity,
     ADD COLUMN abnormal_reason VARCHAR(500) NULL AFTER receive_result,
     ADD COLUMN return_to_stock BOOLEAN NOT NULL DEFAULT false AFTER abnormal_reason,
     ADD COLUMN received_at DATETIME(6) NULL AFTER return_to_stock,
     ADD COLUMN receive_operator_name VARCHAR(60) NULL AFTER received_at,
     ADD COLUMN receive_remark VARCHAR(500) NULL AFTER receive_operator_name,
     ADD COLUMN refund_method VARCHAR(40) NULL AFTER refund_status,
     ADD COLUMN refund_no VARCHAR(80) NULL AFTER refund_method,
     ADD COLUMN refund_operator_name VARCHAR(60) NULL AFTER refund_no,
     ADD COLUMN refunded_at DATETIME(6) NULL AFTER refund_operator_name,
     ADD COLUMN refund_remark VARCHAR(500) NULL AFTER refunded_at,
     ADD COLUMN close_reason VARCHAR(500) NULL AFTER refund_remark,
     ADD COLUMN closed_by VARCHAR(60) NULL AFTER close_reason,
     ADD COLUMN closed_at DATETIME(6) NULL AFTER closed_by,
     ADD COLUMN credential_urls TEXT NULL AFTER closed_at,
     ADD COLUMN after_sale_deadline_at DATETIME(6) NULL AFTER credential_urls'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE after_sale_orders
SET apply_amount = refund_amount
WHERE apply_amount = 0.00
  AND refund_amount > 0.00;

UPDATE after_sale_orders
SET refundable_amount = refund_amount
WHERE refundable_amount = 0.00
  AND refund_amount > 0.00;
