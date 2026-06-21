CREATE TABLE product_sku_code_legacy_backup (
  product_id BIGINT NOT NULL,
  product_code VARCHAR(32) NOT NULL,
  sku_code VARCHAR(32) NOT NULL,
  backed_up_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_sku_code_legacy_backup (product_id, product_code, sku_code)
SELECT id, product_code, sku_code
FROM products;

UPDATE products
SET sku_list_json = JSON_ARRAY(JSON_OBJECT(
  'skuCode', sku_code,
  'skuBarcode', COALESCE(sku_barcode, ''),
  'skuName', sku_name,
  'salePrice', sale_price,
  'stockQuantity', stock_quantity,
  'minOrderQuantity', min_order_quantity,
  'skuStatus', COALESCE(sku_status, 'ENABLED')
))
WHERE sku_list_json IS NULL
   OR TRIM(sku_list_json) = ''
   OR JSON_VALID(sku_list_json) = 0
   OR JSON_LENGTH(CASE WHEN JSON_VALID(sku_list_json) = 1 THEN sku_list_json ELSE '[]' END) = 0;

CREATE TEMPORARY TABLE product_code_resequence (
  product_id BIGINT NOT NULL,
  product_code VARCHAR(7) NOT NULL,
  PRIMARY KEY (product_id),
  UNIQUE KEY uk_product_code_resequence_code (product_code)
);

SET @product_code_sequence := 0;

INSERT INTO product_code_resequence (product_id, product_code)
SELECT id, LPAD((@product_code_sequence := @product_code_sequence + 1), 7, '0')
FROM products
ORDER BY id DESC;

UPDATE products
SET product_code = CONCAT('TMP-', id);

UPDATE products p
JOIN product_code_resequence r ON r.product_id = p.id
SET p.product_code = r.product_code;

ALTER TABLE products
  MODIFY COLUMN product_code VARCHAR(7) NOT NULL,
  DROP INDEX uk_products_sku_code,
  DROP COLUMN sku_code;

CREATE TABLE product_code_sequences (
  sequence_name VARCHAR(32) NOT NULL,
  next_value BIGINT NOT NULL,
  PRIMARY KEY (sequence_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_code_sequences (sequence_name, next_value)
SELECT 'product', COUNT(*) + 1
FROM products;

DROP TEMPORARY TABLE product_code_resequence;
