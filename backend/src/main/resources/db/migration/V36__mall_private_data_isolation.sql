SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND COLUMN_NAME = 'customer_id'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies ADD COLUMN customer_id BIGINT NULL AFTER id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE invoice_applies i
JOIN sales_orders o ON o.order_no = i.order_no
SET i.customer_id = o.customer_id
WHERE i.customer_id IS NULL;

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_applies'
      AND INDEX_NAME = 'idx_invoice_applies_customer_id'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE invoice_applies ADD KEY idx_invoice_applies_customer_id (customer_id)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS mall_cart_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  spec_index INT NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  checked BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_mall_cart_items_customer_product_spec (customer_id, product_id, spec_index),
  KEY idx_mall_cart_items_customer_id (customer_id),
  KEY idx_mall_cart_items_product_id (product_id),
  CONSTRAINT fk_mall_cart_items_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_mall_cart_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
