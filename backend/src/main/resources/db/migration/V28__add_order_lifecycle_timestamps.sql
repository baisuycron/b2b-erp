SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sales_orders'
      AND COLUMN_NAME = 'payment_time'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE sales_orders
     ADD COLUMN payment_time DATETIME(6) NULL AFTER payment_method,
     ADD COLUMN payment_no VARCHAR(80) NULL AFTER payment_time,
     ADD COLUMN receive_time DATETIME(6) NULL AFTER payment_no,
     ADD COLUMN completed_time DATETIME(6) NULL AFTER receive_time'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE sales_orders
SET payment_no = CONCAT('PAY', REPLACE(order_no, 'SO', ''))
WHERE payment_status = 'PAID'
  AND (payment_no IS NULL OR payment_no = '');

UPDATE sales_orders
SET payment_time = created_at
WHERE payment_status = 'PAID'
  AND payment_time IS NULL;

UPDATE sales_orders
SET receive_time = updated_at
WHERE fulfillment_status = 'RECEIVED'
  AND receive_time IS NULL;

UPDATE sales_orders
SET completed_time = updated_at
WHERE order_status = 'COMPLETED'
  AND completed_time IS NULL;
