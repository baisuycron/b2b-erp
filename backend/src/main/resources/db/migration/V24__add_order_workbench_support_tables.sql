CREATE TABLE IF NOT EXISTS order_shipments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  shipment_no VARCHAR(40) NOT NULL,
  order_id BIGINT NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  shipment_method VARCHAR(30) NOT NULL DEFAULT 'EXPRESS',
  logistics_company VARCHAR(80) NULL,
  logistics_no VARCHAR(80) NULL,
  operator_name VARCHAR(60) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_shipments_no (shipment_no),
  KEY idx_order_shipments_order_id (order_id),
  KEY idx_order_shipments_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS after_sale_orders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  after_sale_no VARCHAR(40) NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  buyer_name VARCHAR(120) NOT NULL,
  after_sale_type VARCHAR(40) NOT NULL,
  product_name VARCHAR(120) NULL,
  quantity INT NOT NULL DEFAULT 0,
  refund_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  after_sale_status VARCHAR(40) NOT NULL,
  reason VARCHAR(500) NULL,
  audit_remark VARCHAR(500) NULL,
  refund_status VARCHAR(40) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_after_sale_orders_no (after_sale_no),
  KEY idx_after_sale_orders_order_no (order_no),
  KEY idx_after_sale_orders_status (after_sale_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS after_sale_return_logistics (
  id BIGINT NOT NULL AUTO_INCREMENT,
  after_sale_id BIGINT NOT NULL,
  logistics_company VARCHAR(80) NULL,
  logistics_no VARCHAR(80) NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_after_sale_return_logistics_after_sale_id (after_sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_applies (
  id BIGINT NOT NULL AUTO_INCREMENT,
  invoice_apply_no VARCHAR(40) NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  buyer_name VARCHAR(120) NOT NULL,
  invoice_type VARCHAR(40) NOT NULL,
  title_type VARCHAR(40) NOT NULL,
  invoice_title VARCHAR(160) NOT NULL,
  tax_no VARCHAR(60) NULL,
  apply_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  receive_email VARCHAR(120) NULL,
  invoice_status VARCHAR(40) NOT NULL,
  invoice_no VARCHAR(80) NULL,
  reject_reason VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_invoice_applies_no (invoice_apply_no),
  KEY idx_invoice_applies_order_no (order_no),
  KEY idx_invoice_applies_status (invoice_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_files (
  id BIGINT NOT NULL AUTO_INCREMENT,
  invoice_apply_id BIGINT NOT NULL,
  file_name VARCHAR(160) NOT NULL,
  invoice_no VARCHAR(80) NULL,
  invoice_type VARCHAR(40) NOT NULL,
  invoice_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  ocr_status VARCHAR(40) NOT NULL DEFAULT 'WAIT_OCR',
  ocr_result TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_invoice_files_apply_id (invoice_apply_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_titles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  buyer_name VARCHAR(120) NOT NULL,
  title_type VARCHAR(40) NOT NULL,
  invoice_title VARCHAR(160) NOT NULL,
  tax_no VARCHAR(60) NULL,
  receive_email VARCHAR(120) NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_invoice_titles_buyer_name (buyer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
