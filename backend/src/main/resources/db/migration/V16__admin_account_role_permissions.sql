CREATE TABLE IF NOT EXISTS admin_roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(60) NOT NULL,
  role_desc VARCHAR(255) NULL,
  account_count INT NOT NULL DEFAULT 0,
  role_status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  permission_json TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_accounts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  account_name VARCHAR(32) NOT NULL,
  real_name VARCHAR(60) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  role_name VARCHAR(255) NOT NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_accounts_account_name (account_name),
  UNIQUE KEY uk_admin_accounts_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operation_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  log_no VARCHAR(40) NOT NULL,
  operator_name VARCHAR(60) NOT NULL,
  module_name VARCHAR(60) NOT NULL,
  operation_name VARCHAR(80) NOT NULL,
  related_no VARCHAR(80) NULL,
  operation_content VARCHAR(500) NULL,
  operation_result VARCHAR(20) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_operation_logs_no (log_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO admin_roles (role_name, role_desc, account_count, role_status, permission_json)
VALUES
  ('超级管理员', '系统内置角色，默认拥有全部后台菜单权限', 0, 'ENABLED', '["dashboard","goods","goods:product-list","goods:product-category","goods:product-brand","purchase","purchase:supplier","purchase:purchase-order","purchase:purchase-inbound","stock","stock:stock-overview","stock:stock-flow","order","aftersale","invoice","buyer","finance","finance:finance-payment","finance:finance-refund","system","system:system-user","system:system-role","system:system-log","system:system-config"]'),
  ('仓库人员', '仓库人员默认可查看库存与订单履约相关菜单', 0, 'ENABLED', '["dashboard","stock","stock:stock-overview","stock:stock-flow","order"]'),
  ('财务人员', '财务人员默认可查看开票与财务菜单', 0, 'ENABLED', '["dashboard","invoice","finance","finance:finance-payment","finance:finance-refund"]');

INSERT INTO admin_accounts (account_name, real_name, phone, password_hash, role_name, account_status)
SELECT '1001', 'admin', '18888888888', TO_BASE64(UNHEX(SHA2('123456', 256))), '超级管理员', 'ENABLED'
WHERE NOT EXISTS (SELECT 1 FROM admin_accounts WHERE phone = '18888888888' OR account_name = '1001');

INSERT INTO admin_accounts (account_name, real_name, phone, password_hash, role_name, account_status)
SELECT '1002', 'warehouse01', '13666666666', TO_BASE64(UNHEX(SHA2('123456', 256))), '仓库人员', 'ENABLED'
WHERE NOT EXISTS (SELECT 1 FROM admin_accounts WHERE phone = '13666666666' OR account_name = '1002');

INSERT INTO admin_accounts (account_name, real_name, phone, password_hash, role_name, account_status)
SELECT '1003', 'finance01', '13999999999', TO_BASE64(UNHEX(SHA2('123456', 256))), '财务人员', 'DISABLED'
WHERE NOT EXISTS (SELECT 1 FROM admin_accounts WHERE phone = '13999999999' OR account_name = '1003');

SET @admin_account_seed := (
  SELECT GREATEST(1000, COALESCE(MAX(CAST(account_name AS UNSIGNED)), 1000))
  FROM admin_accounts
  WHERE account_name REGEXP '^[0-9]+$'
);
SET @admin_account_seq := @admin_account_seed;

UPDATE admin_accounts a
JOIN (
  SELECT id
  FROM admin_accounts
  WHERE account_name IS NULL OR account_name = '' OR account_name NOT REGEXP '^[0-9]+$'
  ORDER BY id
) s ON s.id = a.id
SET a.account_name = CAST((@admin_account_seq := @admin_account_seq + 1) AS CHAR);

UPDATE admin_roles r
SET account_count = (
  SELECT COUNT(*)
  FROM admin_accounts a
  WHERE FIND_IN_SET(r.role_name, REPLACE(a.role_name, '、', ',')) > 0
);
