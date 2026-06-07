CREATE TABLE product_categories (
  id BIGINT NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(120) NOT NULL,
  parent_name VARCHAR(120) NULL,
  sort_no INT NOT NULL DEFAULT 0,
  category_status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_brands (
  id BIGINT NOT NULL AUTO_INCREMENT,
  brand_name VARCHAR(120) NOT NULL,
  first_letter VARCHAR(8) NULL,
  sort_no INT NOT NULL DEFAULT 0,
  brand_status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_brands_name (brand_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_categories (category_name, parent_name, sort_no, category_status)
VALUES
  ('包装饮用水', '-', 10, 'ENABLED'),
  ('办公物资', '-', 20, 'ENABLED'),
  ('餐饮耗材', '-', 30, 'ENABLED');

INSERT INTO product_brands (brand_name, first_letter, sort_no, brand_status)
VALUES
  ('自营优选', 'Z', 10, 'ENABLED'),
  ('企业集采', 'Q', 20, 'ENABLED'),
  ('办公严选', 'B', 30, 'ENABLED');
