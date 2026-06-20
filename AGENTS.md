# B2B ERP Agent Notes

## Deployment Safety

- When the user clearly asks to deploy this repository, first decide whether the current change is frontend-only or includes backend changes.
- For frontend UI deployments, use the repo frontend deploy flow instead of manually zipping `web/*`.
- Prefer `npm run deploy:ui` from the repo root when npm is available. In this Windows environment, if npm is not on PATH, run `.tools\deploy-react-ui.ps1` directly.
- The frontend deploy flow is frontend-only:
  - builds Vite output to `dist-web`
  - syncs current build artifacts into `web/`
  - clears stale files under `web/assets/`
  - packages `web/*` into `.tools\react-ui-deploy.zip`
  - uploads the zip and `.tools\react-ui-deploy-server.ps1` to `124.223.21.76`
  - deploys to `C:\erp\b2b-web`
  - verifies the live site asset hashes on `http://124.223.21.76:8081/` and `http://124.223.21.76:8081/mall.html`
  - verifies `http://124.223.21.76:8081/api/admin/summary`
- Do not restart or redeploy the backend for frontend-only changes unless the user explicitly asks for backend or full-stack deployment.
- If backend files changed and the user asks to deploy the repository, deploy backend with `.tools\deploy-current-backend.ps1` before deploying the frontend.

## Deploy Notes

- The deploy key is `.tools\b2b_erp_deploy_key`.
- In this environment, OpenSSH may reject the key unless a temporary copy is created with restricted ACLs for the actual executing user. The repo deploy scripts already handle this.
- Prefer repo scripts over ad hoc `scp`/`ssh` commands.

## Safe Package Notes

- `scripts\build-safe-ui-package.ps1` exists as a marker-validated UI package helper for legacy static admin/mall sources.
- Use it only when intentionally deploying that legacy safe-package path. Do not mix it with the normal Vite `dist-web -> web` deployment in the same deploy.

## 商品接口与图片性能规则

### 1. 列表接口轻量化

商品列表接口只能返回列表展示、筛选、排序需要的轻量字段。

后台商品列表接口：

* `GET /api/admin/products`

商城商品列表接口：

* `GET /api/mall/products`

以上列表接口禁止返回以下大字段：

* `data:image` 开头的 base64 图片
* `detailContent`
* `skuListJson`
* `tierPricesJson`
* `skuList`
* `tierPrices`
* 商品详情图
* 商品轮播原图
* 富文本 HTML
* 规格图片原图

列表接口必须从后端源头减少返回体积，禁止先返回大字段再由前端过滤。

### 2. 详情接口返回完整数据

商品完整数据只能通过详情接口获取。

后台商品详情接口：

* `GET /api/admin/products/{id}`

商城商品详情接口：

* `GET /api/mall/products/{id}`

以下场景必须调用详情接口：

* 后台编辑商品
* 后台查看商品详情
* 商城进入商品详情页
* 需要回显商品规格、商品属性、商品详情、图片、阶梯价等完整信息的场景

列表接口中的商品行数据不能作为完整商品详情使用。

### 3. 商品主图规则

商品列表和商城商品卡片仍然需要展示商品主图，但必须使用缩略图 URL。

列表接口允许返回：

* `mainImageThumbnailUrl`
* `thumbnailUrl`
* `mainImageUrl`

图片取值优先级：

1. `mainImageThumbnailUrl`
2. `thumbnailUrl`
3. `mainImageUrl`

如果 `mainImageUrl` 存储的是 `data:image` base64 原图，列表接口不能返回该字段内容，应返回缩略图 URL 或空字符串。

如果暂时没有缩略图，前端应展示默认图片占位，不允许为了展示图片而返回 base64 原图。

### 4. 前端图片展示规则

列表页、商品档案表格、商城商品卡片中，图片地址如果以 `data:image` 开头，不得直接渲染，应显示默认占位。

图片标签应增加：

```tsx
loading="lazy"
decoding="async"
```

图片加载失败时，应显示默认占位，不应造成页面布局跳动。

### 5. 编辑页和详情页性能规则

打开后台编辑商品时，同一个商品详情接口不能重复请求。

如果同一个 `productId` 的详情请求正在进行中，应复用正在进行的 Promise，避免重复请求。

商品编辑页中的重组件应尽量懒渲染：

* 默认只渲染基础信息区域
* 商品规格 Tab 点击后再渲染规格复杂组件
* 商品属性 Tab 点击后再渲染属性内容
* 商品详情 Tab 点击后再初始化富文本编辑器

### 6. 验收标准

修改商品相关接口或页面后，必须检查：

1. `/api/admin/products` 响应中不能出现 `data:image`
2. `/api/admin/products` 响应中不能出现 `detailContent`
3. `/api/admin/products` 响应中不能出现 `skuListJson`
4. `/api/admin/products` 响应中不能出现 `tierPricesJson`
5. `/api/mall/products` 响应中不能出现 `data:image`
6. `/api/mall/products` 响应中不能出现 `detailContent`
7. `/api/mall/products` 响应中不能出现 `skuListJson`
8. `/api/mall/products` 响应中不能出现 `tierPricesJson`
9. 商品列表和商城商品卡片仍然能展示缩略图或默认占位图
10. 后台商品编辑页完整信息必须正常回显
11. 商城商品详情页完整信息必须正常显示
12. 页面布局、表格列、分页位置、查询条件、分类树不得被无关修改

### 7. 商品图片多尺寸规则

商品图片不能只生成一个低清缩略图。不同页面应使用不同尺寸的图片，兼顾加载性能和展示清晰度。

推荐图片字段：

* `mainImageThumbUrl`：后台表格小缩略图，建议 120×120
* `mainImageCardUrl`：商城商品卡片图，建议 400×400 或 500×500
* `mainImageUrl`：商品详情主图，建议 800×800 或原图 URL

使用规则：

1. 后台商品档案列表优先使用 `mainImageThumbUrl`。
2. PC 商城商品卡片优先使用 `mainImageCardUrl`。
3. 商品详情页优先使用 `mainImageUrl`。
4. 商品列表接口仍然禁止返回 `data:image` base64 原图。
5. 不允许为了图片清晰度重新把 base64 原图放回列表接口。
6. 不允许商城商品卡片使用过小的 120×120 缩略图后再强行放大展示。
7. 如果商品卡片区域约为 180px～240px，应至少提供 400×400 级别的卡片图，以适配高清屏。
8. 如果暂时没有 `mainImageCardUrl`，前端可降级使用 `mainImageThumbnailUrl` 或 `mainImageUrl`，但如果地址以 `data:image` 开头，列表页不得渲染，应显示默认占位。

前端图片取值优先级：

后台商品档案列表：

```ts
mainImageThumbUrl || mainImageThumbnailUrl || thumbnailUrl || mainImageUrl
```

PC 商城商品卡片：

```ts
mainImageCardUrl || mainImageThumbnailUrl || thumbnailUrl || mainImageUrl
```

商品详情页：

```ts
mainImageUrl || mainImageCardUrl || mainImageThumbnailUrl
```

图片标签应保持：

```tsx
loading="lazy"
decoding="async"
```

商城商品卡片图片样式应避免低清图被强行拉伸。推荐：

```css
object-fit: contain;
```

验收标准：

1. `/api/mall/products` 响应中不能出现 `data:image`。
2. `/api/mall/products` 返回体积仍应保持较小。
3. 商城商品卡片图片必须清晰，不能明显模糊。
4. 后台商品档案列表仍然加载快速。
5. 商品详情页图片正常显示高清图。
6. 不得为了提升清晰度牺牲列表加载性能。
