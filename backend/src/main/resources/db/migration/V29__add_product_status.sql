ALTER TABLE products
  ADD COLUMN product_status VARCHAR(20) NOT NULL DEFAULT 'NEW' AFTER tier_prices_json,
  ADD KEY idx_products_product_status (product_status);

UPDATE products
SET product_status = CASE
  WHEN created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'NORMAL'
  ELSE 'NEW'
END;
