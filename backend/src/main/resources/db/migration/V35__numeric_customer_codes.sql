UPDATE customers
SET customer_code = CONCAT('TMP-', id);

UPDATE customers c
JOIN (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY id ASC), 6, '0') AS new_customer_code
  FROM customers
) numbered ON numbered.id = c.id
SET c.customer_code = numbered.new_customer_code;

CREATE TABLE IF NOT EXISTS customer_code_sequence (
  id TINYINT NOT NULL,
  next_value INT NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO customer_code_sequence (id, next_value)
SELECT 1, COALESCE(MAX(CAST(customer_code AS UNSIGNED)), 0) + 1
FROM customers
WHERE customer_code REGEXP '^[0-9]{6}$'
ON DUPLICATE KEY UPDATE next_value = VALUES(next_value);

SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME = 'chk_customers_customer_code_digits'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE customers ADD CONSTRAINT chk_customers_customer_code_digits CHECK (customer_code REGEXP ''^[0-9]{6}$'')'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
