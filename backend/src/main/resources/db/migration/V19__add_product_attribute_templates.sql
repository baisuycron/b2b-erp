CREATE TABLE product_attribute_templates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  template_name VARCHAR(60) NOT NULL,
  fields_json TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_attribute_templates_name (template_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE products
  ADD COLUMN attribute_template_id BIGINT NULL AFTER brand_name,
  ADD COLUMN custom_attributes_json TEXT NULL AFTER attribute_template_id,
  ADD KEY idx_products_attribute_template_id (attribute_template_id),
  ADD CONSTRAINT fk_products_attribute_template
    FOREIGN KEY (attribute_template_id) REFERENCES product_attribute_templates (id)
    ON DELETE SET NULL;
