# 商品以图搜图部署说明

本项目已预留真实图片搜索链路，不会返回假相似商品：

1. 用户上传图片到 `POST /api/mall/products/search-by-image`
2. Spring Boot 校验图片格式和 5MB 大小限制
3. Spring Boot 调用图片向量服务生成 embedding
4. Spring Boot 查询 Qdrant TopK 相似图片
5. Spring Boot 按 `productId` 回查 MySQL 商品数据，过滤已下架商品
6. 返回 `productId/productName/imageUrl/price/categoryName/brandName/similarity`

## 1. 启动 Qdrant

```powershell
docker run -d --name b2b-qdrant `
  -p 6333:6333 `
  -v qdrant_storage:/qdrant/storage `
  qdrant/qdrant:latest
```

创建 collection 时维度必须与图片 embedding 模型输出一致。例如 CLIP ViT-B/32 常见为 512 维：

```powershell
curl -X PUT http://127.0.0.1:6333/collections/product-images `
  -H "Content-Type: application/json" `
  -d "{\"vectors\":{\"size\":512,\"distance\":\"Cosine\"}}"
```

## 2. 启动图片向量服务

图片向量服务建议使用 Python FastAPI，至少提供两个接口：

```text
POST /embed/image
Content-Type: multipart/form-data
file: image

POST /embed/image-url
Content-Type: application/json
{ "imageUrl": "https://..." }
```

返回格式：

```json
{
  "embedding": [0.0123, -0.0456]
}
```

生产建议：

- 阶段 1：OCR + 关键词搜索，用于商品包装、标签、票据类图片。
- 阶段 2：CLIP/中文 CLIP 生成图片向量，商品主图离线入库，用户图片在线检索。
- 图片向量服务不要把模型结果写死；模型、向量维度、归一化方式需要和 Qdrant collection 保持一致。

## 3. 配置 Spring Boot

```powershell
$env:IMAGE_SEARCH_ENABLED="true"
$env:IMAGE_EMBEDDING_SERVICE_URL="http://127.0.0.1:9000"
$env:QDRANT_URL="http://127.0.0.1:6333"
$env:IMAGE_VECTOR_COLLECTION="product-images"
```

如果 Qdrant 开启 API Key：

```powershell
$env:QDRANT_API_KEY="your-key"
```

未配置时，接口会返回：

```text
图片搜索能力暂未接入，请联系管理员配置图片搜索服务
```

## 4. 重建商品图片向量

商品新增或编辑后，系统会把商品主图和 SKU 图登记到 `product_image_vectors`，状态为 `PENDING`。

调用后台重建接口：

```powershell
curl -X POST "http://127.0.0.1:8080/api/admin/products/images/rebuild-vector?limit=100"
```

重建流程：

1. 读取 `PENDING/FAILED` 商品图片
2. 调用图片向量服务 `/embed/image-url`
3. 将向量和 payload 写入 Qdrant
4. 更新 `vectorStatus` 为 `READY`

向量 payload 至少包含：

```json
{
  "productId": 1,
  "skuId": "SKU-1",
  "imageUrl": "https://...",
  "categoryId": 10,
  "brandId": 3,
  "productStatus": "ON_SALE"
}
```

当前商品主表以分类名、品牌名为主，重建时会尽量按名称回查分类 ID 和品牌 ID。生产建议把 `categoryId`、`brandId` 固化到商品主表或商品图片同步事件中。

## 5. 前端接入

PC 商城搜索框已接入：

- 文本搜索：`GET /api/mall/products?keyword=xxx`
- 图片搜索：`POST /api/mall/products/search-by-image`
- 图片搜索接口未接入时，前端只提示未接入，不展示假结果。
