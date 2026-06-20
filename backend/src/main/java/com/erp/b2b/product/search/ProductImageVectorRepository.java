package com.erp.b2b.product.search;

import com.erp.b2b.product.Product;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ProductImageVectorRepository {
    private static final Pattern IMG_SRC_PATTERN = Pattern.compile(
        "<img\\b[^>]*\\bsrc\\s*=\\s*([\"'])(.*?)\\1",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ProductImageVectorRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void syncFromProduct(Product product) {
        jdbcClient.sql("DELETE FROM product_image_vectors WHERE product_id = :productId")
            .param("productId", product.id())
            .update();
        saveImages(product);
    }

    public int syncMissingFromProducts(List<Product> products) {
        int queued = 0;
        for (Product product : products) {
            Integer existing = jdbcClient.sql("""
                SELECT COUNT(*)
                FROM product_image_vectors
                WHERE product_id = :productId
                """)
                .param("productId", product.id())
                .query(Integer.class)
                .single();
            if (existing != null && existing > 0) {
                continue;
            }

            int before = countByProduct(product.id());
            saveImages(product);
            queued += Math.max(0, countByProduct(product.id()) - before);
        }
        return queued;
    }

    public int replaceAllFromProducts(List<Product> products) {
        jdbcClient.sql("DELETE FROM product_image_vectors")
            .update();
        int queued = 0;
        for (Product product : products) {
            int before = countByProduct(product.id());
            saveImages(product);
            queued += Math.max(0, countByProduct(product.id()) - before);
        }
        return queued;
    }

    public List<ProductImageVector> listPending(int limit) {
        return jdbcClient.sql("""
            SELECT id, product_id, sku_id, image_url, image_type, vector_id, vector_status
            FROM product_image_vectors
            WHERE vector_status IN ('PENDING', 'FAILED')
            ORDER BY updated_at ASC, id ASC
            LIMIT :limit
            """)
            .param("limit", Math.max(1, Math.min(limit, 500)))
            .query(this::mapVector)
            .list();
    }

    public int resetAllToPending() {
        return jdbcClient.sql("""
            UPDATE product_image_vectors
            SET vector_id = NULL,
                vector_status = 'PENDING'
            """)
            .update();
    }

    public void markVectorized(Long id, String vectorId) {
        jdbcClient.sql("""
            UPDATE product_image_vectors
            SET vector_id = :vectorId,
                vector_status = 'READY'
            WHERE id = :id
            """)
            .param("id", id)
            .param("vectorId", vectorId)
            .update();
    }

    public void markFailed(Long id) {
        jdbcClient.sql("""
            UPDATE product_image_vectors
            SET vector_status = 'FAILED'
            WHERE id = :id
            """)
            .param("id", id)
            .update();
    }

    private void saveImages(Product product) {
        Set<String> seen = new LinkedHashSet<>();
        saveImage(product.id(), null, product.mainImageUrl(), "MAIN", seen);
        for (String imageUrl : detailImages(product.detailContent())) {
            saveImage(product.id(), null, imageUrl, "DETAIL", seen);
        }
        for (Map<String, Object> sku : skuRows(product.skuListJson())) {
            String skuId = text(sku.get("skuCode"));
            for (String imageUrl : skuImages(sku)) {
                saveImage(product.id(), skuId, imageUrl, "SKU", seen);
            }
        }
    }

    private void saveImage(Long productId, String skuId, String imageUrl, String imageType) {
        saveImage(productId, skuId, imageUrl, imageType, new LinkedHashSet<>());
    }

    private void saveImage(Long productId, String skuId, String imageUrl, String imageType, Set<String> seen) {
        String url = text(imageUrl);
        if (url.isBlank() || !seen.add(url)) {
            return;
        }
        jdbcClient.sql("""
            INSERT INTO product_image_vectors (product_id, sku_id, image_url, image_type, vector_status)
            VALUES (:productId, :skuId, :imageUrl, :imageType, 'PENDING')
            """)
            .param("productId", productId)
            .param("skuId", skuId == null || skuId.isBlank() ? null : skuId)
            .param("imageUrl", url)
            .param("imageType", imageType)
            .update();
    }

    private List<String> detailImages(String raw) {
        Set<String> images = new LinkedHashSet<>();
        String text = text(raw);
        if (text.isBlank()) {
            return List.of();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(text, new TypeReference<>() {});
            collectImageValue(parsed.get("imageUrl"), images);
            collectImageValue(parsed.get("detailImageUrl"), images);
            collectImageValue(parsed.get("carouselImages"), images);
            collectHtmlImages(text(parsed.get("html")), images);
            collectHtmlImages(text(parsed.get("text")), images);
            collectHtmlImages(text(parsed.get("detailText")), images);
        } catch (Exception ignored) {
            collectHtmlImages(text, images);
        }
        return List.copyOf(images);
    }

    private List<String> skuImages(Map<String, Object> sku) {
        Set<String> images = new LinkedHashSet<>();
        collectImageValue(sku.get("skuImageUrl"), images);
        collectImageValue(sku.get("imageUrl"), images);
        collectImageValue(sku.get("image"), images);
        collectImageValue(sku.get("specValues"), images);
        return List.copyOf(images);
    }

    private void collectImageValue(Object value, Set<String> images) {
        if (value == null) {
            return;
        }
        if (value instanceof String stringValue) {
            String text = text(stringValue);
            if (looksLikeImageUrl(text)) {
                images.add(text);
            } else if (text.contains("<img")) {
                collectHtmlImages(text, images);
            }
            return;
        }
        if (value instanceof Iterable<?> iterable) {
            for (Object item : iterable) {
                collectImageValue(item, images);
            }
            return;
        }
        if (value instanceof Map<?, ?> map) {
            for (Object item : map.values()) {
                collectImageValue(item, images);
            }
        }
    }

    private void collectHtmlImages(String html, Set<String> images) {
        String text = text(html);
        if (text.isBlank()) {
            return;
        }
        Matcher matcher = IMG_SRC_PATTERN.matcher(text);
        while (matcher.find()) {
            String src = text(matcher.group(2));
            if (looksLikeImageUrl(src)) {
                images.add(src);
            }
        }
    }

    private boolean looksLikeImageUrl(String value) {
        String text = text(value);
        if (text.isBlank()) {
            return false;
        }
        String lower = text.toLowerCase();
        return lower.startsWith("data:image/")
            || lower.startsWith("http://")
            || lower.startsWith("https://")
            || lower.startsWith("/uploads/")
            || lower.startsWith("uploads/");
    }

    private int countByProduct(Long productId) {
        Integer count = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM product_image_vectors
            WHERE product_id = :productId
            """)
            .param("productId", productId)
            .query(Integer.class)
            .single();
        return count == null ? 0 : count;
    }

    private List<Map<String, Object>> skuRows(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private ProductImageVector mapVector(ResultSet rs, int rowNum) throws SQLException {
        return new ProductImageVector(
            rs.getLong("id"),
            rs.getLong("product_id"),
            rs.getString("sku_id"),
            rs.getString("image_url"),
            rs.getString("image_type"),
            rs.getString("vector_id"),
            rs.getString("vector_status")
        );
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
