UPDATE customers
SET
  company_name = CONVERT(0xe4b88ae6b5b7e99d92e7a6bee8b4b8e69893e69c89e99990e585ace58fb8 USING utf8mb4),
  contact_name = CONVERT(0xe78e8be5b08fe7a6be USING utf8mb4),
  salesman_name = CONVERT(0xe99988e699a8 USING utf8mb4)
WHERE customer_code = 'CUST-0001';

UPDATE customers
SET
  company_name = CONVERT(0xe69dade5b79ee4ba91e98787e4be9be5ba94e993bee69c89e99990e585ace58fb8 USING utf8mb4),
  contact_name = CONVERT(0xe69d8ee4ba91 USING utf8mb4),
  salesman_name = CONVERT(0xe99988e699a8 USING utf8mb4)
WHERE customer_code = 'CUST-0002';

UPDATE products
SET
  product_name = CONVERT(0xe4bc81e4b89ae8a385e68abde7bab8 USING utf8mb4),
  sku_name = CONVERT(0xe695b4e7aeb120323420e58c85 USING utf8mb4),
  unit = CONVERT(0xe7aeb1 USING utf8mb4)
WHERE product_code = 'P-0001';

UPDATE products
SET
  product_name = CONVERT(0xe59586e794a8e6b497e6898be6b6b2 USING utf8mb4),
  sku_name = CONVERT(0x3530306d6c202a20313220e793b6 USING utf8mb4),
  unit = CONVERT(0xe7aeb1 USING utf8mb4)
WHERE product_code = 'P-0002';

UPDATE products
SET
  product_name = CONVERT(0xe4b880e6aca1e680a7e9a490e79b92 USING utf8mb4),
  sku_name = CONVERT(0x313030306d6c202a2033303020e5a597 USING utf8mb4),
  unit = CONVERT(0xe7aeb1 USING utf8mb4)
WHERE product_code = 'P-0003';

UPDATE sales_orders so
JOIN customers c ON c.id = so.customer_id
SET so.customer_name = c.company_name;

UPDATE sales_order_items soi
JOIN products p ON p.id = soi.product_id
SET
  soi.product_name = p.product_name,
  soi.sku_name = p.sku_name,
  soi.unit = p.unit;
