package com.erp.b2b.product.search;

import com.erp.b2b.product.Product;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ProductImageVectorRepository {
    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ProductImageVectorRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void syncFromProduct(Product product) {
        jdbcClient.sql("DELETE FROM product_image_vectors WHERE product_id = :productId")
            .param("productId", product.id())
            .update();
        saveImage(product.id(), null, product.mainImageUrl(), "MAIN");
        for (Map<String, Object> sku : skuRows(product.skuListJson())) {
            String skuId = text(sku.get("skuCode"));
            String imageUrl = text(sku.get("skuImageUrl"));
            saveImage(product.id(), skuId, imageUrl, "SKU");
        }
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
            saveImage(product.id(), null, product.mainImageUrl(), "MAIN");
            for (Map<String, Object> sku : skuRows(product.skuListJson())) {
                String skuId = text(sku.get("skuCode"));
                String imageUrl = text(sku.get("skuImageUrl"));
                saveImage(product.id(), skuId, imageUrl, "SKU");
            }
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

    private void saveImage(Long productId, String skuId, String imageUrl, String imageType) {
        String url = text(imageUrl);
        if (url.isBlank()) {
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
