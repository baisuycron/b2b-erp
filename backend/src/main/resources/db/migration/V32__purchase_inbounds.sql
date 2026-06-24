CREATE TABLE IF NOT EXISTS purchase_inbounds (
  id BIGINT NOT NULL AUTO_INCREMENT,
  inbound_no VARCHAR(32) NOT NULL,
  supplier_id BIGINT NOT NULL,
  supplier_name VARCHAR(120) NOT NULL,
  inbound_date DATE NOT NULL,
  handler_name VARCHAR(60) NOT NULL,
  total_quantity INT NOT NULL DEFAULT 0,
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  remark VARCHAR(500) NULL,
  created_by VARCHAR(60) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  reviewed_by VARCHAR(60) NULL,
  reviewed_at DATETIME(6) NULL,
  reject_reason VARCHAR(500) NULL,
  review_remark VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_inbounds_no (inbound_no),
  KEY idx_purchase_inbounds_supplier (supplier_id),
  KEY idx_purchase_inbounds_status (status),
  KEY idx_purchase_inbounds_inbound_date (inbound_date),
  KEY idx_purchase_inbounds_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_inbound_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  inbound_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  sku_id BIGINT NULL,
  sku_code VARCHAR(32) NOT NULL,
  sku_name VARCHAR(120) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  purchase_price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  line_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  before_stock INT NULL,
  after_stock INT NULL,
  item_remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_purchase_inbound_items_inbound (inbound_id),
  KEY idx_purchase_inbound_items_product (product_id),
  KEY idx_purchase_inbound_items_sku (sku_code),
  CONSTRAINT fk_purchase_inbound_items_inbound FOREIGN KEY (inbound_id) REFERENCES purchase_inbounds (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_inbound_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  inbound_id BIGINT NOT NULL,
  operator_name VARCHAR(60) NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  action_content VARCHAR(500) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_purchase_inbound_logs_inbound (inbound_id),
  CONSTRAINT fk_purchase_inbound_logs_inbound FOREIGN KEY (inbound_id) REFERENCES purchase_inbounds (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE admin_roles
SET permission_json = REPLACE(permission_json, '"purchase:purchase-order"', '"purchase:purchase-inbound"')
WHERE permission_json LIKE '%"purchase:purchase-order"%';
