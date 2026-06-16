ALTER TABLE products
  ADD COLUMN sale_mode VARCHAR(20) NOT NULL DEFAULT 'NORMAL' AFTER quote_type,
  ADD COLUMN sale_unit VARCHAR(20) NULL AFTER sale_mode,
  ADD COLUMN sale_unit_ratio INT NULL AFTER sale_unit;

UPDATE products
SET sale_mode = 'NORMAL',
    sale_unit = NULL,
    sale_unit_ratio = NULL
WHERE sale_mode IS NULL OR sale_mode = '';
