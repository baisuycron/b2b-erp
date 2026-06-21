CREATE TABLE buyer_browse_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  view_count INT NOT NULL DEFAULT 1,
  viewed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_buyer_browse_history_customer_product (customer_id, product_id),
  KEY idx_buyer_browse_history_customer_viewed (customer_id, viewed_at),
  KEY idx_buyer_browse_history_product (product_id),
  CONSTRAINT fk_buyer_browse_history_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_buyer_browse_history_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
