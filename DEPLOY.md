# B2B ERP Deployment Handover

## 0. Current repo boundary

Before deployment, please confirm one important point:

- Read `API_AUDIT.md` first. It explains exactly which frontend APIs are and are not covered by the current Java backend.
- The current Java backend in `backend/` is **not** a complete business backend for the whole site.

- The frontend code in `src/` and `web/` calls many endpoints under `/api/admin/*`, `/api/mall/*`, `/api/buyer/*`.
- The Java backend in `backend/` clearly implements only a subset of APIs found in code, including:
  - `/api/health`
  - `/api/customers`
  - `/api/products`
  - `/api/orders`
  - `/api/inventory-movements`
- This means the repository is suitable for:
  - frontend static deployment
  - basic Java API deployment
  - database initialization through Flyway
- This repository alone does **not** prove that the full admin login, mall, buyer, invoice, after-sales, finance, role, and system-parameter APIs are implemented in `backend/`.
- If you must preserve the current business capability of the existing system, keep `/api/admin`, `/api/mall`, `/api/buyer`, and `/api/system` proxied to the old backend service.

If your production environment already has another API service behind `/api`, keep that service mapping unchanged.

## 1. Project technology stack

### Frontend

- Framework: React 18
- Build tool: Vite 6
- UI library: Ant Design 5
- Language: TypeScript
- HTTP client: Axios
- Charts: ECharts

### Backend

- Framework: Spring Boot 3.3.6
- Language: Java 21
- Build tool: Maven
- Data access: Spring JDBC
- Validation: Jakarta Validation
- Database migration: Flyway

### Runtime and middleware

- Node version:
  - No `.nvmrc` or `engines` is declared at project root.
  - Based on the locked Vite 6 toolchain, use Node `18+`.
  - Recommended: Node `20 LTS`.
- Package manager: `npm` (`package-lock.json`, lockfile v3)
- Database: MySQL 8.x
- Redis: not found in current code
- Object storage / file storage middleware: not found in current code
- MQ / cache middleware: not found in current code
- Frontend/backend separation: yes
  - Frontend lives at repo root
  - Backend lives in `backend/`
  - Current preferred deployment mode is frontend static site + backend API

## 2. Directory map

### Frontend directories

- Source: `src/`
- Static public assets: `public/`
- Static deployment package directory: `web/`
- Frontend build output: `dist-web/`

### Backend directories

- Java source: `backend/src/main/java/`
- Backend resources: `backend/src/main/resources/`
- Backend build output: `backend/target/`

### Config directories

- Frontend config: `vite.config.ts`, `tsconfig.json`
- Backend config: `backend/src/main/resources/application.yml`
- Deployment scripts:
  - frontend: `.tools/deploy-react-ui.ps1`
  - backend (Windows-oriented): `backend/scripts/`

### Database and migration directories

- Flyway SQL migrations: `backend/src/main/resources/db/migration/`

### Upload file directories

- Current codebase does **not** implement server-side multipart upload storage.
- Product images and SKU images are currently stored as base64/data URL or JSON text in database fields.
- So there is no mandatory runtime upload directory in the current implementation.

## 3. Local startup

### Install dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
cd backend
mvn clean package -DskipTests
```

### Start frontend in development

```bash
npm run dev
```

Default address:

- `http://127.0.0.1:5173`

Important note:

- Current `vite.config.ts` proxies `/api` to `VITE_DEV_PROXY_TARGET`.
- Default fallback is still `http://124.223.21.76:8081`.
- If you want to call a local backend, set `VITE_DEV_PROXY_TARGET=http://127.0.0.1:8080`.

### Start backend in development

Recommended:

```bash
cd backend
mvn spring-boot:run
```

Or package then run:

```bash
cd backend
mvn clean package -DskipTests
java -jar target/b2b-api-0.1.0-SNAPSHOT.jar
```

### Local addresses

- Frontend dev: `http://127.0.0.1:5173`
- Backend health check: `http://127.0.0.1:8080/api/health`

## 4. Production build and startup

### Frontend build

```bash
npm run build
```

Output:

- `dist-web/`

Optional UI deploy packaging directory:

- `web/`

Current repo also provides a Windows deployment script:

```powershell
npm run deploy:ui
```

### Backend build

```bash
cd backend
mvn clean package -DskipTests
```

Output:

- `backend/target/b2b-api-0.1.0-SNAPSHOT.jar`

### Backend production start

```bash
cd backend
java -jar target/b2b-api-0.1.0-SNAPSHOT.jar
```

## 5. Environment variables

Template file:

- `.env.example`

Suggested usage:

```bash
cp .env.example .env
```

### Variables included

- `SERVER_PORT`
- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `UPLOAD_DIR`
- `VITE_API_BASE_URL`
- `VITE_DEV_PROXY_TARGET`
- `CORS_ALLOWED_ORIGIN`
- `JAVA_OPTS`

### Important notes

- `SERVER_PORT`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` are consumed by current backend code.
- `VITE_API_BASE_URL` is now supported by `src/shared/api.ts`.
- `VITE_DEV_PROXY_TARGET` is now supported by `vite.config.ts`.
- `JWT_SECRET`, `UPLOAD_DIR`, `CORS_ALLOWED_ORIGIN` are placeholders for deployment consistency, but the current backend code does not consume them yet.

## 6. Database deployment

Detailed note:

- `DATABASE_INIT.md`

### Summary

- Create database:

```sql
CREATE DATABASE b2b_erp
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

- `schema.sql`: not found
- Migration: yes, Flyway migrations exist under `backend/src/main/resources/db/migration/`
- Seed data: yes
  - `V1__init_core_schema.sql` creates base tables and inserts seed customers/products
  - `V2__repair_seed_text.sql` fixes seed text encoding
  - `V11__add_product_spec_types.sql` creates and seeds `product_spec_types`
- Admin account initialization:
  - not found in current Java backend code
  - no admin user table or JWT bootstrap logic is visible in `backend/`
- How to run migration:
  - start the Spring Boot app
  - Flyway runs automatically on startup

## 7. Deployment method A: ordinary server deployment

This is the recommended structure for a standard server:

- Nginx serves frontend static files
- Java service serves backend API on `127.0.0.1:8080`
- MySQL runs independently

### 7.1 Install runtime dependencies

Install:

- Node.js 20 LTS
- npm 10+
- Java 21
- Maven 3.9+
- MySQL 8
- Nginx
- PM2

PM2 install:

```bash
npm install -g pm2
```

### 7.2 Upload or pull source code

```bash
git clone <your-repo-url> b2b-erp
cd b2b-erp
```

Or upload the working tree directly to the server.

### 7.3 Install dependencies

```bash
npm install
cd backend
mvn clean package -DskipTests
cd ..
```

### 7.4 Build frontend

```bash
npm run build
```

### 7.5 Configure environment variables

```bash
cp .env.example .env
```

Fill at least:

- `SERVER_PORT`
- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `VITE_API_BASE_URL=/api`

### 7.6 Publish frontend files

Example:

```bash
mkdir -p /data/www/b2b-erp
cp -r dist-web/* /data/www/b2b-erp/
```

Ordinary server mode uses:

- Nginx root: `/data/www/b2b-erp`
- Frontend source for publishing: `dist-web/`

### 7.7 Start backend service

Option 1: direct start

```bash
cd backend
export SERVER_PORT=8080
export DB_URL='jdbc:mysql://127.0.0.1:3306/b2b_erp?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai'
export DB_USERNAME='b2b_erp'
export DB_PASSWORD='change_me'
java -jar target/b2b-api-0.1.0-SNAPSHOT.jar
```

Option 2: PM2 startup

```bash
export SERVER_PORT=8080
export DB_URL='jdbc:mysql://127.0.0.1:3306/b2b_erp?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai'
export DB_USERNAME='b2b_erp'
export DB_PASSWORD='change_me'
pm2 start ecosystem.config.js --env production
```

### 7.8 PM2 management

Config file provided:

- `ecosystem.config.js`

Commands:

```bash
pm2 start ecosystem.config.js --env production
pm2 status
pm2 logs b2b-api
pm2 restart b2b-api
pm2 stop b2b-api
pm2 delete b2b-api
pm2 save
pm2 startup
```

### 7.9 Nginx configuration

Ordinary server deployment config:

- `nginx.conf.example`
- root: `/data/www/b2b-erp`
- `/api/` proxy target: `http://127.0.0.1:8080`

If you need "new frontend + old backend interface" mode instead, use:

- `nginx.old-backend.conf.example`
- root: `/data/www/b2b-erp`
- `/api/` proxy target: your old backend service

After placing it on the server:

```bash
nginx -t
systemctl reload nginx
```

### 7.10 Auto-start

- Backend: `pm2 save` and `pm2 startup`
- Nginx: enable with system service manager

Example:

```bash
systemctl enable nginx
systemctl enable mysql
```

### 7.11 Logs

Backend:

```bash
pm2 logs b2b-api
```

Nginx:

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 7.12 Restart

```bash
pm2 restart b2b-api
systemctl reload nginx
```

## 8. Deployment method B: Docker

Suitable for:

- quick environment setup
- demo deployment
- reproducible frontend + backend + mysql stack

Provided files:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `nginx.docker.conf.example`

### Build and start

```bash
docker compose up -d --build
```

### Stop

```bash
docker compose down
```

### Restart

```bash
docker compose restart
```

### Logs

```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f nginx
docker compose logs -f mysql
```

### Data volume mounts

- MySQL data: `mysql-data`
- Uploads placeholder directory: `./docker-data/uploads:/data/b2b-erp/uploads`

Note:

- Current code does not actually write uploaded files into `UPLOAD_DIR`.
- The volume is kept for future compatibility and Nginx mapping.
- Docker frontend mode uses Nginx root `/usr/share/nginx/html`.
- `Dockerfile` now copies `nginx.docker.conf.example` into the image, instead of reusing the ordinary server config.

## 9. Nginx config

There are now three Nginx examples with different purposes:

- `nginx.conf.example`
  - ordinary server deployment
  - root `/data/www/b2b-erp`
  - `/api/` proxies to the current Java backend service
- `nginx.docker.conf.example`
  - Docker frontend container deployment
  - root `/usr/share/nginx/html`
  - `/api/` proxies to the `backend` container
- `nginx.old-backend.conf.example`
  - new frontend + old backend interface mode
  - root `/data/www/b2b-erp`
  - `/api/` proxies to the old backend service

It supports:

- frontend history refresh fallback
- `/api` reverse proxy to backend
- `/uploads/` static alias
- gzip

### History routing note

Current frontend build has `index.html` and `mall.html`.

- `/` and frontend routes fallback to `/index.html`
- `/mall.html` is served as an explicit entry file

## 10. File upload configuration

### Current actual implementation

- Product main image: stored in database field `products.main_image_url`
- Detail image/text: stored in database field `products.detail_content`
- SKU image: stored inside JSON stored in `products.sku_list_json`
- Frontend image handling compresses files into data URLs before submit

### Conclusion

- No server-side upload directory is mandatory in the current implementation.
- Nginx does not need a real upload alias for current product/SKU image display if data URLs are used.

### If you want to switch to file storage later

Recommended directories:

- `/data/b2b-erp/uploads/products`
- `/data/b2b-erp/uploads/sku`
- `/data/b2b-erp/uploads/detail`

Permissions:

```bash
mkdir -p /data/b2b-erp/uploads/products
mkdir -p /data/b2b-erp/uploads/sku
mkdir -p /data/b2b-erp/uploads/detail
chown -R www-data:www-data /data/b2b-erp/uploads
chmod -R 755 /data/b2b-erp/uploads
```

Nginx access:

- map `/uploads/` to `/data/b2b-erp/uploads/`

## 11. Frontend API address configuration

### Current production recommendation

Use:

```env
VITE_API_BASE_URL=/api
```

This keeps frontend requests same-origin and lets Nginx proxy `/api` to whichever backend you choose for the deployment mode.

Important production note:

- If you use the current Java backend from this repository, `/api` can point to that Java service.
- If you need to preserve the legacy business capability, `/api/admin`, `/api/mall`, `/api/buyer`, and `/api/system` should continue to resolve through the old backend service, typically by keeping all `/api/` traffic on that old service.

### Current development recommendation

Use:

```env
VITE_DEV_PROXY_TARGET=http://127.0.0.1:8080
```

### Where it is configured

- frontend runtime base URL: `src/shared/api.ts`
- Vite dev proxy target: `vite.config.ts`
- template values: `.env.example`

### If deployed to server

Recommended production value:

```env
VITE_API_BASE_URL=/api
```

Do not fill a full public domain unless you explicitly want cross-origin API calls.

## 12. Deployment acceptance checklist

### Minimum checks

- `GET /api/health` returns success
- frontend homepage opens without white screen
- `mall.html` opens normally
- JS and CSS assets return `200`
- refreshing a frontend route does not return `404`
- `/api` requests are forwarded correctly
- restarting backend service does not break Nginx access

### Business checks requested by you

Please verify these one by one after deployment:

- login
- product list
- create product
- edit product
- product image upload
- sale mode save and replay
- SKU detail save and replay
- page refresh
- API requests
- service restart recovery

### Important accuracy note

Because the current `backend/` codebase does not clearly implement the full `/api/admin/*` login and management APIs, the following checks depend on your real API service, not just this repository:

- login
- full product admin management
- after-sales
- finance
- buyer center
- role/permission pages

If those capabilities must remain available, do not switch `/api/` fully to the Java backend from this repository.
Keep the old backend proxy in place, or use `nginx.old-backend.conf.example`.

## 13. Troubleshooting

### Blank page

Possible causes:

- static files not copied completely
- wrong `index.html` referencing old asset hashes
- Nginx root points to wrong directory

Check:

```bash
ls -la /data/www/b2b-erp
grep assets /data/www/b2b-erp/index.html
```

Docker mode check:

```bash
ls -la /usr/share/nginx/html
grep assets /usr/share/nginx/html/index.html
```

### API 404

Possible causes:

- backend not started
- Nginx `/api` proxy not configured
- frontend is calling endpoints not implemented by current Java backend

Check:

```bash
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1/api/health
```

### CORS

If you use same-origin `/api`, this should usually not happen.

If you use full-domain API URLs:

- add backend CORS support
- or switch back to `VITE_API_BASE_URL=/api`

### Refresh 404

Cause:

- Nginx missing `try_files $uri $uri/ /index.html;`

### Images not displayed

Possible causes:

- DB image field is empty
- DB content is truncated
- if later moved to file storage, `/uploads/` alias is wrong

### Database connection failed

Check:

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- MySQL charset and timezone

### Port already in use

Check:

```bash
ss -lntp | grep 8080
ss -lntp | grep 80
```

### PM2 startup failed

Possible causes:

- Java not in `PATH`
- jar path wrong
- env vars not exported before `pm2 start`

Check:

```bash
java -version
pm2 logs b2b-api
```

### Nginx config error

Check:

```bash
nginx -t
```

## 14. Delivery package

Current complete delivery package is built with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .tools/build-project-delivery.ps1
```

Output:

- staging directory: `outputs/project_delivery/b2b-erp-delivery-YYYYMMDD/`
- zip archive: `outputs/project_delivery/b2b-erp-delivery-YYYYMMDD.zip`

Important packaging note:

- The packaging script writes zip entries with `/` as the internal path separator.
- After Linux unzip, you should get standard directories such as:
  - `b2b-erp-delivery-YYYYMMDD/src/`
  - `b2b-erp-delivery-YYYYMMDD/backend/`
  - `b2b-erp-delivery-YYYYMMDD/dist-web/`

## 15. Files delivered in this handover package

- `DEPLOY.md`
- `API_AUDIT.md`
- `.env.example`
- `nginx.conf.example`
- `nginx.docker.conf.example`
- `nginx.old-backend.conf.example`
- `ecosystem.config.js`
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `DATABASE_INIT.md`
- `.tools/build-project-delivery.ps1`
