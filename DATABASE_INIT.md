# Database Initialization

## 1. Create database

```sql
CREATE DATABASE b2b_erp
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

Recommended application user:

```sql
CREATE USER 'b2b_erp'@'%' IDENTIFIED BY 'change_me';
GRANT ALL PRIVILEGES ON b2b_erp.* TO 'b2b_erp'@'%';
FLUSH PRIVILEGES;
```

## 2. Does the project include `schema.sql`?

- No.
- The project uses Flyway migrations instead of a standalone `schema.sql`.

## 3. Does the project include migrations?

- Yes.
- Directory: `backend/src/main/resources/db/migration/`

Current files found:

- `V1__init_core_schema.sql`
- `V2__repair_seed_text.sql`
- `V3__add_product_media_fields.sql`
- `V10__add_product_sku_barcode.sql`
- `V11__add_product_spec_types.sql`
- `V12__add_product_sale_mode_fields.sql`

## 4. Does the project include seed data?

- Yes.

Seeded by current migrations:

- base customers
- base products
- product spec types

## 5. How to execute migrations

The current project runs Flyway automatically when the Spring Boot app starts.

Required variables:

```bash
export DB_URL='jdbc:mysql://127.0.0.1:3306/b2b_erp?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai'
export DB_USERNAME='b2b_erp'
export DB_PASSWORD='change_me'
```

Run:

```bash
cd backend
mvn clean package -DskipTests
java -jar target/b2b-api-0.1.0-SNAPSHOT.jar
```

On first startup:

- Flyway creates `flyway_schema_history`
- all missing SQL migrations are applied automatically

## 6. How to verify initialization

After startup, verify:

```bash
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/customers
curl http://127.0.0.1:8080/api/products
```

## 7. Administrator account initialization

- No administrator bootstrap script was found in the current Java backend.
- No admin table, password seed, or JWT initialization flow is clearly implemented in `backend/`.
- If your production admin login works today, it is likely provided by another backend service or another unretrieved code path.

## 8. Notes about product images

- Product and SKU images are currently stored in database text fields and JSON fields.
- No database-side file pointer migration is required for the current implementation.
