SET @supplier_sequence = 0;

UPDATE suppliers
SET supplier_no = CONCAT('TMP-', id);

UPDATE suppliers
SET supplier_no = LPAD((@supplier_sequence := @supplier_sequence + 1), 5, '0')
ORDER BY id;
