CREATE TABLE customers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_code VARCHAR(32) NOT NULL,
  company_name VARCHAR(120) NOT NULL,
  contact_name VARCHAR(60) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  audit_status VARCHAR(20) NOT NULL,
  salesman_name VARCHAR(60) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_customers_code (customer_code),
  KEY idx_customers_company_name (company_name),
  KEY idx_customers_audit_status (audit_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id BIGINT NOT NULL AUTO_INCREMENT,
  product_code VARCHAR(32) NOT NULL,
  sku_code VARCHAR(32) NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  sku_name VARCHAR(120) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  sale_price DECIMAL(18,2) NOT NULL,
  stock_quantity INT NOT NULL,
  min_order_quantity INT NOT NULL DEFAULT 1,
  sale_status VARCHAR(20) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_products_product_code (product_code),
  UNIQUE KEY uk_products_sku_code (sku_code),
  KEY idx_products_name (product_name),
  KEY idx_products_sale_status (sale_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sales_orders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  order_status VARCHAR(30) NOT NULL,
  payment_status VARCHAR(30) NOT NULL,
  fulfillment_status VARCHAR(30) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,
  total_amount DECIMAL(18,2) NOT NULL,
  receiver_name VARCHAR(60) NOT NULL,
  receiver_phone VARCHAR(30) NOT NULL,
  receiver_address VARCHAR(255) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_sales_orders_order_no (order_no),
  KEY idx_sales_orders_customer_id (customer_id),
  KEY idx_sales_orders_status (order_status),
  CONSTRAINT fk_sales_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sales_order_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  sku_code VARCHAR(32) NOT NULL,
  sku_name VARCHAR(120) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  shipped_quantity INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(18,2) NOT NULL,
  line_amount DECIMAL(18,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_sales_order_items_order_id (order_id),
  KEY idx_sales_order_items_product_id (product_id),
  CONSTRAINT fk_sales_order_items_order FOREIGN KEY (order_id) REFERENCES sales_orders (id),
  CONSTRAINT fk_sales_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_movements (
  id BIGINT NOT NULL AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  movement_type VARCHAR(30) NOT NULL,
  quantity_delta INT NOT NULL,
  stock_after INT NOT NULL,
  source_type VARCHAR(30) NOT NULL,
  source_no VARCHAR(32) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_inventory_movements_product_id (product_id),
  KEY idx_inventory_movements_source (source_type, source_no),
  CONSTRAINT fk_inventory_movements_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO customers (customer_code, company_name, contact_name, contact_phone, audit_status, salesman_name)
VALUES
  ('CUST-0001', CONVERT(0xe4b88ae6b5b7e99d92e7a6bee8b4b8e69893e69c89e99990e585ace58fb8 USING utf8mb4), CONVERT(0xe78e8be5b08fe7a6be USING utf8mb4), '13800010001', 'APPROVED', CONVERT(0xe99988e699a8 USING utf8mb4)),
  ('CUST-0002', CONVERT(0xe69dade5b79ee4ba91e98787e4be9be5ba94e993bee69c89e99990e585ace58fb8 USING utf8mb4), CONVERT(0xe69d8ee4ba91 USING utf8mb4), '13800010002', 'APPROVED', CONVERT(0xe99988e699a8 USING utf8mb4));

INSERT INTO products (product_code, sku_code, product_name, sku_name, unit, sale_price, stock_quantity, min_order_quantity, sale_status)
VALUES
  ('P-0001', 'SKU-0001', CONVERT(0xe4bc81e4b89ae8a385e68abde7bab8 USING utf8mb4), CONVERT(0xe695b4e7aeb120323420e58c85 USING utf8mb4), CONVERT(0xe7aeb1 USING utf8mb4), 89.00, 120, 1, 'ON_SALE'),
  ('P-0002', 'SKU-0002', CONVERT(0xe59586e794a8e6b497e6898be6b6b2 USING utf8mb4), CONVERT(0x3530306d6c202a20313220e793b6 USING utf8mb4), CONVERT(0xe7aeb1 USING utf8mb4), 156.00, 80, 1, 'ON_SALE'),
  ('P-0003', 'SKU-0003', CONVERT(0xe4b880e6aca1e680a7e9a490e79b92 USING utf8mb4), CONVERT(0x313030306d6c202a2033303020e5a597 USING utf8mb4), CONVERT(0xe7aeb1 USING utf8mb4), 118.00, 60, 2, 'ON_SALE');
