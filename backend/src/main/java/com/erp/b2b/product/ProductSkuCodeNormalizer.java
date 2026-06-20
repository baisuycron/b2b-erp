package com.erp.b2b.product;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class ProductSkuCodeNormalizer {
    private static final int MAX_SKU_TEXT_LENGTH = 18;

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ProductSkuCodeNormalizer(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void normalizeExistingSkuCodes() {
        List<Map<String, Object>> products = jdbcClient.sql("""
            SELECT id, sku_code, sku_list_json
            FROM products
            ORDER BY id ASC
            """)
            .query((rs, rowNum) -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", rs.getLong("id"));
                row.put("skuCode", rs.getString("sku_code"));
                row.put("skuListJson", rs.getString("sku_list_json"));
                return row;
            })
            .list();

        for (Map<String, Object> product : products) {
            normalizeProduct(product);
        }
    }

    private void normalizeProduct(Map<String, Object> product) {
        Long productId = longValue(product.get("id"));
        if (productId == null) return;

        String productSkuCode = text(product.get("skuCode"));
        String nextProductSkuCode = normalizeSkuCode(productSkuCode);
        String rawSkuListJson = text(product.get("skuListJson"));
        String nextSkuListJson = rawSkuListJson;

        List<Map<String, Object>> skuRows = parseSkuRows(rawSkuListJson);
        boolean changed = !nextProductSkuCode.equals(productSkuCode);
        if (!skuRows.isEmpty()) {
            List<Map<String, Object>> nextRows = new ArrayList<>();
            for (int index = 0; index < skuRows.size(); index += 1) {
                Map<String, Object> source = skuRows.get(index);
                Map<String, Object> row = new LinkedHashMap<>(source);
                String currentSkuCode = text(row.get("skuCode"));
                String nextSkuCode = normalizeSkuCode(currentSkuCode);
                if (nextSkuCode.isBlank()) {
                    nextSkuCode = generatedSkuCode(productId, index);
                }
                if (!nextSkuCode.equals(currentSkuCode)) {
                    changed = true;
                    row.put("skuCode", nextSkuCode);
                }
                if (index == 0) {
                    nextProductSkuCode = nextSkuCode;
                }
                nextRows.add(row);
            }
            nextSkuListJson = writeSkuRows(nextRows, rawSkuListJson);
            changed = changed || !nextSkuListJson.equals(rawSkuListJson);
        } else if (nextProductSkuCode.isBlank()) {
            nextProductSkuCode = generatedSkuCode(productId, 0);
            changed = true;
        }

        if (!changed) return;

        jdbcClient.sql("""
            UPDATE products
            SET sku_code = :skuCode,
                sku_list_json = :skuListJson
            WHERE id = :id
            """)
            .param("skuCode", nextProductSkuCode)
            .param("skuListJson", nextSkuListJson)
            .param("id", productId)
            .update();
    }

    private List<Map<String, Object>> parseSkuRows(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String writeSkuRows(List<Map<String, Object>> rows, String fallback) {
        try {
            return objectMapper.writeValueAsString(rows);
        } catch (Exception ex) {
            return fallback == null ? "" : fallback;
        }
    }

    private String generatedSkuCode(Long productId, int index) {
        return normalizeSkuCode("SKU" + productId + String.format("%03d", index + 1));
    }

    private String normalizeSkuCode(String value) {
        String text = value == null ? "" : value.replaceAll("[^0-9A-Za-z]", "");
        if (text.length() <= MAX_SKU_TEXT_LENGTH) {
            return text;
        }
        return text.substring(0, MAX_SKU_TEXT_LENGTH);
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
