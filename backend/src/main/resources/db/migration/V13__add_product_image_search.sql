ALTER TABLE products
  ADD COLUMN pinyin_code VARCHAR(120) NULL COMMENT 'Product pinyin short code for mall search',
  ADD COLUMN pinyin_full VARCHAR(255) NULL COMMENT 'Product full pinyin for mall search',
  ADD COLUMN initial_code VARCHAR(80) NULL COMMENT 'Product initial code for mall search',
  ADD KEY idx_products_pinyin_code (pinyin_code),
  ADD KEY idx_products_initial_code (initial_code);

CREATE TABLE product_image_vectors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  sku_id VARCHAR(64) NULL,
  image_url LONGTEXT NOT NULL,
  image_type VARCHAR(30) NOT NULL,
  vector_id VARCHAR(128) NULL,
  vector_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_product_image_vectors_product (product_id),
  KEY idx_product_image_vectors_status (vector_status),
  KEY idx_product_image_vectors_vector (vector_id)
);
