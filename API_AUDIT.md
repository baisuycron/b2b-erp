# API Audit

## Conclusion

The current repository contains:

- complete frontend source code at the repository root
- a Java backend source tree under `backend/`
- deployment files and environment templates

But the current `backend/` source does **not** fully implement all APIs used by the frontend.

If you point `/api` only to the current Java backend in `backend/`, the project cannot run end-to-end as the existing admin + mall system.

In practice, the current frontend still depends on an older or external backend service for most `/api/admin/*`, `/api/mall/*`, and `/api/buyer/*` endpoints.

## 1. Backend APIs confirmed as implemented

These are directly exposed by the current Java controllers:

- `GET /api/health`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/products`
- `GET /api/products/spec-types`
- `POST /api/products/spec-types`
- `POST /api/products`
- `GET /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders`
- `POST /api/orders/{id}/pay`
- `POST /api/orders/{id}/ship`
- `POST /api/orders/{id}/complete`
- `GET /api/inventory-movements`

## 2. Frontend APIs not implemented in the current Java backend

### Admin APIs missing

- `POST /api/admin/login`
- `GET /api/admin/summary`
- `GET /api/admin/products`
- `GET /api/admin/products/{id}`
- `POST /api/admin/products`
- `PUT /api/admin/products/{id}`
- `PUT /api/admin/products/{id}/on-sale`
- `PUT /api/admin/products/{id}/off-sale`
- `GET /api/admin/product-categories`
- `POST /api/admin/product-categories`
- `PUT /api/admin/product-categories/{id}`
- `PUT /api/admin/product-categories/{id}/status`
- `DELETE /api/admin/product-categories/{id}`
- `GET /api/admin/product-brands`
- `POST /api/admin/product-brands`
- `PUT /api/admin/product-brands/{id}`
- `PUT /api/admin/product-brands/{id}/status`
- `DELETE /api/admin/product-brands/{id}`
- `GET /api/admin/suppliers`
- `POST /api/admin/suppliers`
- `PUT /api/admin/suppliers/{id}`
- `PUT /api/admin/suppliers/{id}/status`
- `DELETE /api/admin/suppliers/{id}`
- `GET /api/admin/purchase-orders`
- `POST /api/admin/purchase-orders`
- `POST /api/admin/purchase-orders/{id}/stock-in`
- `GET /api/admin/purchase-stock-ins`
- `GET /api/admin/inventory`
- `GET /api/admin/inventory/flows`
- `POST /api/admin/inventory/adjustments`
- `GET /api/admin/orders`
- `POST /api/admin/orders/{id}/ship`
- `GET /api/admin/after-sales`
- `POST /api/admin/after-sales/{id}/audit`
- `POST /api/admin/after-sales/{id}/refund`
- `GET /api/admin/invoices`
- `POST /api/admin/invoices/{id}/files`
- `POST /api/admin/invoices/{id}/confirm`
- `GET /api/admin/finance/payments`
- `GET /api/admin/finance/refunds`
- `GET /api/admin/accounts`
- `POST /api/admin/accounts`
- `PUT /api/admin/accounts/{id}`
- `PUT /api/admin/accounts/{id}/status`
- `POST /api/admin/accounts/{id}/password/reset`
- `GET /api/admin/roles`
- `POST /api/admin/roles`
- `PUT /api/admin/roles/{id}`
- `GET /api/admin/permissions/tree`
- `GET /api/admin/operation-logs`

### Mall / buyer APIs missing

- `GET /api/mall/products`
- `GET /api/mall/cart`
- `POST /api/mall/cart/items`
- `PUT /api/mall/cart/items/{id}`
- `DELETE /api/mall/cart/items/{id}`
- `GET /api/mall/orders`
- `POST /api/mall/orders/{id}/confirm-receipt`
- `POST /api/mall/payments`
- `GET /api/mall/addresses`
- `POST /api/mall/addresses`
- `PUT /api/mall/addresses/{id}`
- `DELETE /api/mall/addresses/{id}`
- `PUT /api/mall/addresses/{id}/default`
- `GET /api/mall/invoice-titles`
- `POST /api/mall/invoice-titles`
- `PUT /api/mall/invoice-titles/{id}`
- `DELETE /api/mall/invoice-titles/{id}`
- `PUT /api/mall/invoice-titles/{id}/default`
- `POST /api/mall/invoices`
- `POST /api/mall/after-sales`
- `GET /api/buyer/profile`
- `POST /api/buyer/login`
- `POST /api/buyer/register`

### System APIs missing

- `GET /api/system/parameters`
- `PUT /api/system/parameters`

## 3. Frontend calls that only partially overlap with implemented backend

These are important because they can look “close”, but are still not enough for the actual frontend:

- Frontend uses `/api/admin/products`, current backend exposes `/api/products`
- Frontend uses `/api/admin/orders`, current backend exposes `/api/orders`
- Frontend uses `/api/admin/inventory`, current backend exposes `/api/inventory-movements`
- Frontend uses `/api/admin/products/{id}` or fallback `/api/products/{id}`, but the current backend exposes neither detail endpoint
- Frontend mall checkout eventually calls `POST /api/orders`, which is implemented, but the surrounding cart, address, buyer, and payment APIs are missing

## 4. Page impact

## Admin side

### Entire admin login and shell

- Affected: login page, all admin pages
- Reason: `POST /api/admin/login` is missing
- Result: if `/api` points only to the current Java backend, admin login fails first, so all admin pages are blocked

### Dashboard

- Affected page: `dashboard`
- Missing dependencies:
  - `/api/admin/summary`
  - `/api/admin/orders`
  - `/api/admin/purchase-orders`
  - `/api/admin/inventory`
  - `/api/admin/after-sales`
  - `/api/admin/invoices`
  - `/api/admin/finance/payments`
- Result: dashboard data cannot load

### Product management

- Affected pages:
  - `product-list`
  - `product-category`
  - `product-brand`
- Missing dependencies:
  - `/api/admin/products`
  - `/api/admin/product-categories`
  - `/api/admin/product-brands`
  - related `PUT/POST/DELETE/status` endpoints
- Partially available:
  - `/api/products/spec-types`
  - `/api/products`
- Result:
  - current admin product archive page still depends on missing admin endpoints
  - current Java backend is not enough to drive the existing admin product UI

### Supplier / purchasing / stock

- Affected pages:
  - `supplier`
  - `purchase-order`
  - `purchase-inbound`
  - `stock-overview`
  - `stock-flow`
- Missing dependencies:
  - `/api/admin/suppliers`
  - `/api/admin/purchase-orders`
  - `/api/admin/purchase-stock-ins`
  - `/api/admin/inventory`
  - `/api/admin/inventory/flows`
  - `/api/admin/inventory/adjustments`
- Result: these modules cannot work with the current Java backend alone

### Order / after-sales / invoice / finance

- Affected pages:
  - `order`
  - `aftersale`
  - `invoice`
  - `finance-payment`
  - `finance-refund`
- Missing dependencies:
  - `/api/admin/orders`
  - `/api/admin/after-sales`
  - `/api/admin/invoices`
  - `/api/admin/finance/payments`
  - `/api/admin/finance/refunds`
- Result: these modules currently depend on another backend

### System management

- Affected pages:
  - `system-user`
  - `system-role`
  - `system-log`
  - `system-config`
- Missing dependencies:
  - `/api/admin/accounts`
  - `/api/admin/roles`
  - `/api/admin/permissions/tree`
  - `/api/admin/operation-logs`
  - `/api/system/parameters`
- Result: these modules cannot run on the current Java backend alone

### Buyer page inside admin

- Affected page: `buyer`
- Current API usage:
  - `/api/customers`
- Status:
  - this endpoint is implemented
- Limitation:
  - page still sits behind missing `/api/admin/login`
- Result:
  - data source exists
  - actual admin access path is still blocked without the old admin backend

## Mall / mini / buyer side

### Product browsing

- Affected pages:
  - mall home
  - mall list
  - product detail
  - `web/mall.html`
  - `web/mini.html`
- Missing dependencies:
  - `/api/mall/products`
  - `/api/admin/product-categories`
  - `/api/admin/product-brands`
- Result: storefront product browsing cannot load correctly

### Cart and checkout

- Affected pages:
  - cart
  - confirm order
  - pay
- Missing dependencies:
  - `/api/mall/cart`
  - `/api/mall/cart/items`
  - `/api/mall/addresses`
  - `/api/mall/payments`
- Partially available:
  - `POST /api/orders`
- Result:
  - raw order creation exists
  - real storefront checkout flow is still incomplete

### Order center

- Affected pages:
  - orders
  - order detail
- Missing dependencies:
  - `/api/mall/orders`
  - `/api/mall/orders/{id}/confirm-receipt`
- Result: buyer order center depends on old/external backend

### Address / invoice / after-sales / profile / auth

- Affected pages:
  - addresses
  - invoice titles
  - profile
  - login
  - register
  - invoice apply
  - after-sales apply
- Missing dependencies:
  - `/api/mall/addresses`
  - `/api/mall/invoice-titles`
  - `/api/mall/invoices`
  - `/api/mall/after-sales`
  - `/api/buyer/profile`
  - `/api/buyer/login`
  - `/api/buyer/register`
- Result: these pages cannot work on the current Java backend alone

## 5. Does the project depend on the old server backend?

Yes, very likely.

Evidence in the current repository:

- the frontend calls a large `/api/admin/*`, `/api/mall/*`, `/api/buyer/*` surface that does not exist in the Java backend source
- `vite.config.ts` historically proxies `/api` to `http://124.223.21.76:8081`
- `backend/scripts/smoke-test.ps1` even checks `/api/admin/products`, which the current Java backend itself does not expose

## 6. Delivery interpretation

This delivery package contains:

- complete frontend source
- complete currently available backend source
- deployment docs and templates

But it is **not** a fully self-sufficient replacement for the production backend currently serving all admin and mall functions, unless you also obtain the missing old/external backend implementation.

## 7. Practical deployment advice

If your goal is to restore the current live behavior:

- deploy the frontend from this package
- keep the existing old backend service behind `/api`

If your goal is a fully independent new deployment:

- this package is not enough yet
- you still need the missing admin, mall, buyer, payment, invoice, after-sales, account, role, and system-parameter backend implementations
