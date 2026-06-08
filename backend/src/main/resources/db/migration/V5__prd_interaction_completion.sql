CREATE TABLE IF NOT EXISTS order_shipments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  shipment_no VARCHAR(32) NOT NULL,
  order_id BIGINT NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  shipment_method VARCHAR(30) NOT NULL,
  logistics_company VARCHAR(80) NULL,
  logistics_no VARCHAR(80) NULL,
  operator_name VARCHAR(60) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_shipments_no (shipment_no),
  KEY idx_order_shipments_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_files (
  id BIGINT NOT NULL AUTO_INCREMENT,
  invoice_apply_id BIGINT NOT NULL,
  file_name VARCHAR(160) NOT NULL,
  invoice_no VARCHAR(80) NULL,
  invoice_type VARCHAR(30) NULL,
  invoice_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  ocr_status VARCHAR(30) NOT NULL DEFAULT 'WAIT_OCR',
  ocr_result VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_invoice_files_apply_id (invoice_apply_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS after_sale_return_logistics (
  id BIGINT NOT NULL AUTO_INCREMENT,
  after_sale_id BIGINT NOT NULL,
  logistics_company VARCHAR(80) NOT NULL,
  logistics_no VARCHAR(80) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_after_sale_return_logistics_after_sale_id (after_sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
