package com.erp.b2b.product.search;

import com.erp.b2b.common.ApiException;
import com.erp.b2b.product.Product;
import com.erp.b2b.product.ProductRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageSearchService {
    private static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    private static final Set<String> SUPPORTED_TYPES = Set.of(
        "image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp"
    );

    private final ImageSearchProperties properties;
    private final ProductRepository productRepository;
    private final ProductImageVectorRepository imageVectorRepository;
    private final RestClient restClient = RestClient.create();
    private volatile boolean collectionReady;

    public ImageSearchService(
        ImageSearchProperties properties,
        ProductRepository productRepository,
        ProductImageVectorRepository imageVectorRepository
    ) {
        this.properties = properties;
        this.productRepository = productRepository;
        this.imageVectorRepository = imageVectorRepository;
    }

    public List<ProductImageSearchResult> searchByImage(MultipartFile file, Long categoryId, Long brandId, Integer topK) {
        validateImageFile(file);
        ensureConfigured();
        try {
            List<Double> embedding = embedUploadedImage(file);
            ensureVectorCollection(embedding.size());
            List<VectorHit> hits = searchVectorDatabase(embedding, categoryId, brandId, properties.resolvedTopK(topK == null ? 0 : topK));
            List<ProductImageSearchResult> results = hydrateProducts(hits);
            if (results.isEmpty()) {
                throw new ApiException(HttpStatus.NOT_FOUND, "未找到相似商品，请更换图片后重试");
            }
            return results;
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "图片搜索失败，请稍后重试");
        }
    }

    public Map<String, Object> rebuildVectors(Integer limit, boolean full) {
        ensureConfigured();
        int queued;
        int reset;
        if (full) {
            deleteVectorCollection();
            queued = imageVectorRepository.replaceAllFromProducts(productRepository.findAll());
            reset = queued;
        } else {
            queued = imageVectorRepository.syncMissingFromProducts(productRepository.findAll());
            reset = 0;
        }
        int max = limit == null || limit <= 0 ? 100 : Math.min(limit, 500);
        int success = 0;
        int failed = 0;
        int skipped = 0;
        for (ProductImageVector image : imageVectorRepository.listPending(max)) {
            try {
                EmbeddingResponse embeddingResponse = embedImageUrl(image.imageUrl());
                if (Boolean.FALSE.equals(embeddingResponse.indexable())) {
                    imageVectorRepository.markFailed(image.id());
                    skipped += 1;
                    continue;
                }
                List<Double> embedding = requireEmbedding(embeddingResponse);
                ensureVectorCollection(embedding.size());
                Long vectorId = image.id();
                upsertVector(vectorId, embedding, image);
                imageVectorRepository.markVectorized(image.id(), String.valueOf(vectorId));
                success += 1;
            } catch (Exception ex) {
                imageVectorRepository.markFailed(image.id());
                failed += 1;
            }
        }
        return Map.of("success", success, "failed", failed, "skipped", skipped, "limit", max, "queued", queued, "reset", reset);
    }

    public void syncProductImages(Product product) {
        imageVectorRepository.syncFromProduct(product);
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "当前图片格式不支持");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "图片大小不能超过 5MB");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!SUPPORTED_TYPES.contains(contentType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "当前图片格式不支持");
        }
    }

    private void ensureConfigured() {
        if (!properties.configured()) {
            throw new ApiException(HttpStatus.NOT_IMPLEMENTED, "图片搜索能力暂未接入，请联系管理员配置图片搜索服务");
        }
    }

    private List<Double> embedUploadedImage(MultipartFile file) throws IOException {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new MultipartInputStreamResource(file));
        EmbeddingResponse response = restClient.post()
            .uri(trimRight(properties.embeddingServiceUrl()) + "/embed/image")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(body)
            .retrieve()
            .body(EmbeddingResponse.class);
        return requireEmbedding(response);
    }

    private EmbeddingResponse embedImageUrl(String imageUrl) {
        // TODO: production embedding service should fetch private object storage through signed URLs.
        return restClient.post()
            .uri(trimRight(properties.embeddingServiceUrl()) + "/embed/image-url")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("imageUrl", imageUrl))
            .retrieve()
            .body(EmbeddingResponse.class);
    }

    private List<Double> requireEmbedding(EmbeddingResponse response) {
        if (response == null || response.embedding() == null || response.embedding().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "图片搜索失败，请稍后重试");
        }
        return response.embedding();
    }

    private void ensureVectorCollection(int vectorSize) {
        if (collectionReady) {
            return;
        }
        String collectionUrl = trimRight(properties.qdrantUrl()) + "/collections/" + properties.collection();
        try {
            restClient.get()
                .uri(collectionUrl)
                .headers(headers -> {
                    if (properties.qdrantApiKey() != null && !properties.qdrantApiKey().isBlank()) {
                        headers.set("api-key", properties.qdrantApiKey());
                    }
                })
                .retrieve()
                .toBodilessEntity();
            collectionReady = true;
            return;
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() != 404) {
                throw ex;
            }
        }

        restClient.put()
            .uri(collectionUrl)
            .headers(headers -> {
                if (properties.qdrantApiKey() != null && !properties.qdrantApiKey().isBlank()) {
                    headers.set("api-key", properties.qdrantApiKey());
                }
            })
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("vectors", Map.of("size", vectorSize, "distance", "Cosine")))
            .retrieve()
            .toBodilessEntity();
        collectionReady = true;
    }

    private void deleteVectorCollection() {
        collectionReady = false;
        String collectionUrl = trimRight(properties.qdrantUrl()) + "/collections/" + properties.collection();
        try {
            restClient.delete()
                .uri(collectionUrl)
                .headers(headers -> {
                    if (properties.qdrantApiKey() != null && !properties.qdrantApiKey().isBlank()) {
                        headers.set("api-key", properties.qdrantApiKey());
                    }
                })
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() != 404) {
                throw ex;
            }
        }
    }

    private List<VectorHit> searchVectorDatabase(List<Double> embedding, Long categoryId, Long brandId, int topK) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("vector", embedding);
        request.put("limit", topK);
        request.put("with_payload", true);
        double minimumScore = properties.resolvedMinimumScore();
        if (minimumScore > -1) {
            request.put("score_threshold", minimumScore);
        }
        Map<String, Object> filter = qdrantFilter(categoryId, brandId);
        if (!filter.isEmpty()) {
            request.put("filter", filter);
        }
        Map<String, Object> response = restClient.post()
            .uri(trimRight(properties.qdrantUrl()) + "/collections/" + properties.collection() + "/points/search")
            .headers(headers -> {
                if (properties.qdrantApiKey() != null && !properties.qdrantApiKey().isBlank()) {
                    headers.set("api-key", properties.qdrantApiKey());
                }
            })
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .body(Map.class);

        Object result = response == null ? null : response.get("result");
        if (!(result instanceof List<?> rows)) {
            return List.of();
        }
        List<VectorHit> hits = new ArrayList<>();
        for (Object row : rows) {
            if (!(row instanceof Map<?, ?> item)) continue;
            Object payloadValue = item.get("payload");
            if (!(payloadValue instanceof Map<?, ?> payload)) continue;
            Long productId = longValue(payload.get("productId"));
            if (productId == null) continue;
            Double score = doubleValue(item.get("score"));
            double similarity = score == null ? 0 : score;
            if (similarity < minimumScore) continue;
            hits.add(new VectorHit(productId, similarity, text(payload.get("imageUrl"))));
        }
        return hits;
    }

    private void upsertVector(Long vectorId, List<Double> embedding, ProductImageVector image) {
        Product product = productRepository.findById(image.productId()).orElse(null);
        if (product == null) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("productId", product.id());
        payload.put("skuId", image.skuId());
        payload.put("imageUrl", image.imageUrl());
        payload.put("categoryId", productRepository.findCategoryIdByName(product.categoryName()));
        payload.put("categoryName", product.categoryName());
        payload.put("brandId", productRepository.findBrandIdByName(product.brandName()));
        payload.put("brandName", product.brandName());
        payload.put("productStatus", product.saleStatus());
        payload.put("embeddingModel", properties.resolvedEmbeddingModel());

        Map<String, Object> point = new LinkedHashMap<>();
        point.put("id", vectorId);
        point.put("vector", embedding);
        point.put("payload", payload);

        restClient.put()
            .uri(trimRight(properties.qdrantUrl()) + "/collections/" + properties.collection() + "/points")
            .headers(headers -> {
                if (properties.qdrantApiKey() != null && !properties.qdrantApiKey().isBlank()) {
                    headers.set("api-key", properties.qdrantApiKey());
                }
            })
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("points", List.of(point)))
            .retrieve()
            .toBodilessEntity();
    }

    private Map<String, Object> qdrantFilter(Long categoryId, Long brandId) {
        List<Map<String, Object>> must = new ArrayList<>();
        must.add(Map.of("key", "productStatus", "match", Map.of("value", "ON_SALE")));
        must.add(Map.of("key", "embeddingModel", "match", Map.of("value", properties.resolvedEmbeddingModel())));
        if (categoryId != null) {
            must.add(Map.of("key", "categoryId", "match", Map.of("value", categoryId)));
        }
        if (brandId != null) {
            must.add(Map.of("key", "brandId", "match", Map.of("value", brandId)));
        }
        return must.isEmpty() ? Map.of() : Map.of("must", must);
    }

    private List<ProductImageSearchResult> hydrateProducts(List<VectorHit> hits) {
        Map<Long, VectorHit> bestHitByProduct = new LinkedHashMap<>();
        for (VectorHit hit : hits) {
            VectorHit current = bestHitByProduct.get(hit.productId());
            if (current == null || hit.similarity() > current.similarity()) {
                bestHitByProduct.put(hit.productId(), hit);
            }
        }
        List<ProductImageSearchResult> results = new ArrayList<>();
        for (VectorHit hit : bestHitByProduct.values()) {
            Product product = productRepository.findById(hit.productId()).orElse(null);
            if (product == null || !"ON_SALE".equals(product.saleStatus())) {
                continue;
            }
            results.add(new ProductImageSearchResult(
                product.id(),
                product.productName(),
                product.mainImageUrl(),
                product.salePrice() == null ? BigDecimal.ZERO : product.salePrice(),
                product.categoryName(),
                product.brandName(),
                hit.similarity()
            ));
        }
        return results;
    }

    private String trimRight(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Long longValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Double doubleValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private record EmbeddingResponse(List<Double> embedding, Boolean indexable, String rejectionReason) {
    }

    private record VectorHit(Long productId, double similarity, String imageUrl) {
    }

    private static class MultipartInputStreamResource extends InputStreamResource {
        private final MultipartFile file;

        MultipartInputStreamResource(MultipartFile file) throws IOException {
            super(file.getInputStream());
            this.file = file;
        }

        @Override
        public String getFilename() {
            return Objects.requireNonNullElse(file.getOriginalFilename(), "image");
        }

        @Override
        public long contentLength() {
            return file.getSize();
        }

        @Override
        public InputStream getInputStream() throws IOException {
            return file.getInputStream();
        }
    }
}
