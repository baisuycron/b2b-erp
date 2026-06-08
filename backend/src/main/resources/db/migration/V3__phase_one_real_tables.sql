CREATE TABLE suppliers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  supplier_no VARCHAR(32) NOT NULL,
  supplier_name VARCHAR(120) NOT NULL,
  contact_name VARCHAR(60) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  address VARCHAR(255) NULL,
  supplier_status VARCHAR(20) NOT NULL,
  purchase_count INT NOT NULL DEFAULT 0,
  purchase_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_suppliers_no (supplier_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_orders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  purchase_no VARCHAR(32) NOT NULL,
  supplier_id BIGINT NOT NULL,
  supplier_name VARCHAR(120) NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  sku_code VARCHAR(32) NOT NULL,
  purchase_qty INT NOT NULL,
  stocked_qty INT NOT NULL DEFAULT 0,
  purchase_price DECIMAL(18,2) NOT NULL,
  purchase_amount DECIMAL(18,2) NOT NULL,
  expected_arrival_date DATE NULL,
  purchase_status VARCHAR(30) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_orders_no (purchase_no),
  KEY idx_purchase_orders_supplier_id (supplier_id),
  KEY idx_purchase_orders_product_id (product_id),
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_purchase_orders_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_stock_ins (
  id BIGINT NOT NULL AUTO_INCREMENT,
  stock_in_no VARCHAR(32) NOT NULL,
  purchase_order_id BIGINT NOT NULL,
  purchase_no VARCHAR(32) NOT NULL,
  supplier_name VARCHAR(120) NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  sku_code VARCHAR(32) NOT NULL,
  stock_in_qty INT NOT NULL,
  stock_in_amount DECIMAL(18,2) NOT NULL,
  operator_name VARCHAR(60) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_stock_ins_no (stock_in_no),
  KEY idx_purchase_stock_ins_order_id (purchase_order_id),
  CONSTRAINT fk_purchase_stock_ins_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE after_sale_orders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  after_sale_no VARCHAR(32) NOT NULL,
  order_id BIGINT NULL,
  order_no VARCHAR(32) NOT NULL,
  buyer_name VARCHAR(120) NOT NULL,
  after_sale_type VARCHAR(30) NOT NULL,
  product_name VARCHAR(120) NULL,
  quantity INT NOT NULL DEFAULT 1,
  refund_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  after_sale_status VARCHAR(30) NOT NULL,
  reason VARCHAR(255) NULL,
  audit_remark VARCHAR(500) NULL,
  refund_status VARCHAR(30) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_after_sale_orders_no (after_sale_no),
  KEY idx_after_sale_orders_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_titles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  buyer_name VARCHAR(120) NOT NULL,
  title_type VARCHAR(20) NOT NULL,
  invoice_title VARCHAR(160) NOT NULL,
  tax_no VARCHAR(60) NULL,
  receive_email VARCHAR(120) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_applies (
  id BIGINT NOT NULL AUTO_INCREMENT,
  invoice_apply_no VARCHAR(32) NOT NULL,
  order_id BIGINT NULL,
  order_no VARCHAR(32) NOT NULL,
  buyer_name VARCHAR(120) NOT NULL,
  invoice_type VARCHAR(30) NOT NULL,
  title_type VARCHAR(20) NOT NULL,
  invoice_title VARCHAR(160) NOT NULL,
  apply_amount DECIMAL(18,2) NOT NULL,
  receive_email VARCHAR(120) NULL,
  invoice_status VARCHAR(30) NOT NULL,
  invoice_no VARCHAR(60) NULL,
  reject_reason VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_invoice_applies_no (invoice_apply_no),
  KEY idx_invoice_applies_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_accounts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  account_name VARCHAR(60) NOT NULL,
  real_name VARCHAR(60) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  role_name VARCHAR(60) NOT NULL,
  account_status VARCHAR(20) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_accounts_name (account_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(60) NOT NULL,
  role_desc VARCHAR(255) NOT NULL,
  account_count INT NOT NULL DEFAULT 0,
  role_status VARCHAR(20) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE operation_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  log_no VARCHAR(32) NOT NULL,
  operator_name VARCHAR(60) NOT NULL,
  module_name VARCHAR(60) NOT NULL,
  operation_name VARCHAR(60) NOT NULL,
  related_no VARCHAR(32) NULL,
  operation_content VARCHAR(500) NULL,
  operation_result VARCHAR(20) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_operation_logs_no (log_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_parameters (
  param_key VARCHAR(60) NOT NULL,
  param_value VARCHAR(120) NOT NULL,
  param_name VARCHAR(120) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (param_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO suppliers (supplier_no, supplier_name, contact_name, contact_phone, address, supplier_status, purchase_count, purchase_amount)
VALUES
  ('SUP202606070001', '杭州水饮供应链', '周经理', '13600000001', '杭州市余杭区仓前街道', 'ENABLED', 1, 8600.00),
  ('SUP202606070002', '宁波食品供应链', '赵经理', '13600000002', '宁波市鄞州区物流园', 'ENABLED', 1, 4180.00),
  ('SUP202606070003', '苏州办公物资', '钱经理', '13600000003', '苏州市工业园区', 'DISABLED', 0, 0.00);

INSERT INTO purchase_orders (purchase_no, supplier_id, supplier_name, product_id, product_name, sku_code, purchase_qty, stocked_qty, purchase_price, purchase_amount, expected_arrival_date, purchase_status, remark)
SELECT 'PO202606070001', 1, '杭州水饮供应链', id, product_name, sku_code, 300, 0, 28.67, 8600.00, '2026-06-10', 'WAIT_STOCK_IN', '一期采购单'
FROM products ORDER BY id LIMIT 1;

INSERT INTO purchase_orders (purchase_no, supplier_id, supplier_name, product_id, product_name, sku_code, purchase_qty, stocked_qty, purchase_price, purchase_amount, expected_arrival_date, purchase_status, remark)
SELECT 'PO202606070002', 2, '宁波食品供应链', id, product_name, sku_code, 160, 80, 26.13, 4180.00, '2026-06-11', 'PART_STOCK_IN', '一期部分入库采购单'
FROM products ORDER BY id DESC LIMIT 1;

INSERT INTO after_sale_orders (after_sale_no, order_no, buyer_name, after_sale_type, product_name, quantity, refund_amount, after_sale_status, reason)
VALUES
  ('AS202606070001', 'SO202606040010', '上海宏达采购', 'ONLY_REFUND', '康师傅冰红茶 500ml/15瓶', 2, 72.00, 'WAIT_AUDIT', '商品破损'),
  ('AS202606070003', 'SO202606050012', '宁波云仓采购', 'RETURN_REFUND', '娃哈哈 596ml/24瓶', 3, 126.00, 'WAIT_RETURN_RECEIVE', '买家已退货');

INSERT INTO invoice_titles (buyer_name, title_type, invoice_title, tax_no, receive_email, is_default)
VALUES
  ('杭州采购王', 'COMPANY', '杭州某某商贸有限公司', '91330100MA2B2B001X', 'invoice@example.com', TRUE),
  ('杭州采购王', 'PERSONAL', '李先生', NULL, 'buyer@example.com', FALSE);

INSERT INTO invoice_applies (invoice_apply_no, order_no, buyer_name, invoice_type, title_type, invoice_title, apply_amount, receive_email, invoice_status)
VALUES
  ('INV202606070001', 'SO202606050021', '杭州某某商贸', 'E_NORMAL', 'COMPANY', '杭州某某商贸有限公司', 2860.00, 'invoice@example.com', 'WAIT_INVOICE'),
  ('INV202606070002', 'SO202606040018', '苏州瑞丰食品', 'E_SPECIAL', 'COMPANY', '苏州瑞丰食品有限公司', 6420.00, 'finance@example.com', 'INVOICED');

INSERT INTO admin_accounts (account_name, real_name, phone, role_name, account_status)
VALUES
  ('admin', '王管理员', '13888888888', '超级管理员', 'ENABLED'),
  ('warehouse01', '仓库王', '13666666666', '仓库人员', 'ENABLED'),
  ('finance01', '财务李', '13999999999', '财务人员', 'DISABLED');

INSERT INTO admin_roles (role_name, role_desc, account_count, role_status)
VALUES
  ('超级管理员', '拥有全部菜单和全部操作权限', 1, 'ENABLED'),
  ('仓库人员', '负责库存、采购入库、订单发货', 1, 'ENABLED'),
  ('财务人员', '负责支付记录、退款记录和开票处理', 1, 'ENABLED');

INSERT INTO operation_logs (log_no, operator_name, module_name, operation_name, related_no, operation_content, operation_result)
VALUES
  ('LOG202606070001', '仓库王', '采购管理', '采购入库', 'PO202606070001', '采购入库演示数据', 'SUCCESS'),
  ('LOG202606070002', '客服王', '售后管理', '售后审核', 'AS202606070001', '同意买家仅退款申请', 'SUCCESS'),
  ('LOG202606070003', '财务李', '开票管理', '上传发票', 'INV202606070001', '上传2张发票文件', 'SUCCESS');

INSERT INTO system_parameters (param_key, param_value, param_name)
VALUES
  ('payTimeoutMinutes', '15', '支付超时时长'),
  ('autoConfirmReceiptDays', '10', '自动确认收货天数'),
  ('afterSaleDays', '7', '售后期天数'),
  ('stockWarningThreshold', '50', '库存预警阈值');
