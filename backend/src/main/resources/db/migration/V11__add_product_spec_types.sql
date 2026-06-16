CREATE TABLE product_spec_types (
  id BIGINT NOT NULL AUTO_INCREMENT,
  spec_name VARCHAR(20) NOT NULL,
  sort_no INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_spec_types_name (spec_name),
  KEY idx_product_spec_types_sort_no (sort_no),
  KEY idx_product_spec_types_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_spec_types (spec_name, sort_no, status)
VALUES
  ('颜色', 1, 'ENABLED'),
  ('尺码', 2, 'ENABLED'),
  ('型号', 3, 'ENABLED');
