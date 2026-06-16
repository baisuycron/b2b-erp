ALTER TABLE products
  ADD COLUMN main_image_url LONGTEXT NULL AFTER min_order_quantity,
  ADD COLUMN detail_text VARCHAR(5000) NULL AFTER main_image_url,
  ADD COLUMN detail_image_url LONGTEXT NULL AFTER detail_text;
