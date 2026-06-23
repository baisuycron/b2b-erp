ALTER TABLE products
  ADD COLUMN inventory_warning_stock INT NULL AFTER stock_quantity;
