SET @sql := IF(
  (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'buyer_groups'
      AND COLUMN_NAME = 'is_default'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE buyer_groups ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false AFTER remark'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @default_group_name := CONVERT(0xe9bb98e8aea4e58886e7bb84 USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @default_group_id := (
  SELECT id
  FROM buyer_groups
  WHERE group_code = 'BG-DEFAULT' OR group_name COLLATE utf8mb4_unicode_ci = @default_group_name
  ORDER BY CASE WHEN group_code = 'BG-DEFAULT' THEN 0 ELSE 1 END, id ASC
  LIMIT 1
);

INSERT INTO buyer_groups (
  group_code, group_name, status, sort_order, remark, is_default, created_by, updated_by
)
SELECT
  'BG-DEFAULT',
  @default_group_name,
  'ENABLED',
  0,
  CONVERT(0xe7b3bbe7bb9fe9bb98e8aea4e4b9b0e5aeb6e58886e7bb84efbc8ce4b88de58fafe588a0e999a4 USING utf8mb4),
  true,
  'SYSTEM',
  'SYSTEM'
WHERE @default_group_id IS NULL;

SET @default_group_id := (
  SELECT id
  FROM buyer_groups
  WHERE group_code = 'BG-DEFAULT' OR group_name COLLATE utf8mb4_unicode_ci = @default_group_name
  ORDER BY CASE WHEN group_code = 'BG-DEFAULT' THEN 0 ELSE 1 END, id ASC
  LIMIT 1
);

UPDATE buyer_groups
SET is_default = (id = @default_group_id);

UPDATE buyer_groups
SET status = 'ENABLED',
    sort_order = 0,
    updated_by = 'SYSTEM'
WHERE id = @default_group_id;

UPDATE customers
SET group_id = @default_group_id
WHERE group_id IS NULL;
