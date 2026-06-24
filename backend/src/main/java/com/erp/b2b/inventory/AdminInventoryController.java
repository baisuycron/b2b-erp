package com.erp.b2b.inventory;

import com.erp.b2b.common.ApiException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/inventory")
public class AdminInventoryController {
    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> SKU_LIST_TYPE = new TypeReference<>() {};

    public AdminInventoryController(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        List<Map<String, Object>> rows = inventoryRows();
        return row(
            "skuTotal", rows.size(),
            "normalCount", countStatus(rows, "NORMAL"),
            "warningCount", countStatus(rows, "WARNING"),
            "outOfStockCount", countStatus(rows, "OUT_OF_STOCK"),
            "negativeCount", countStatus(rows, "NEGATIVE"),
            "frozenCount", rows.stream().filter(item -> intValue(item.get("frozenStock"), 0) > 0).count(),
            "abnormalCount", rows.stream().filter(this::isAbnormal).count(),
            "todayOutboundQuantity", todayOutboundQuantity()
        );
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Long categoryId,
        @RequestParam(required = false) Long brandId,
        @RequestParam(required = false) String productStatus,
        @RequestParam(required = false) String stockStatus,
        @RequestParam(required = false) Boolean hasFrozenStock,
        @RequestParam(required = false) Boolean belowWarning,
        @RequestParam(required = false) Boolean abnormalOnly,
        @RequestParam(required = false) Integer availableStockMin,
        @RequestParam(required = false) Integer availableStockMax,
        @RequestParam(required = false) Integer actualStockMin,
        @RequestParam(required = false) Integer actualStockMax
    ) {
        int safePage = Math.max(1, page);
        int safePageSize = Math.min(50, Math.max(1, pageSize));
        String categoryName = categoryId == null ? "" : lookupName("product_categories", "category_name", categoryId);
        String brandName = brandId == null ? "" : lookupName("product_brands", "brand_name", brandId);
        List<Map<String, Object>> filtered = inventoryRows().stream()
            .filter(item -> matchesKeyword(item, keyword))
            .filter(item -> categoryName.isBlank() || categoryName.equals(string(item.get("categoryName"))))
            .filter(item -> brandName.isBlank() || brandName.equals(string(item.get("brandName"))))
            .filter(item -> productStatus == null || productStatus.isBlank() || productStatus.equalsIgnoreCase(string(item.get("productStatus"))))
            .filter(item -> stockStatus == null || stockStatus.isBlank() || stockStatus.equalsIgnoreCase(string(item.get("stockStatus"))))
            .filter(item -> hasFrozenStock == null || (intValue(item.get("frozenStock"), 0) > 0) == hasFrozenStock)
            .filter(item -> belowWarning == null || belowWarning(item) == belowWarning)
            .filter(item -> abnormalOnly == null || !abnormalOnly || isAbnormal(item))
            .filter(item -> availableStockMin == null || intValue(item.get("availableStock"), 0) >= availableStockMin)
            .filter(item -> availableStockMax == null || intValue(item.get("availableStock"), 0) <= availableStockMax)
            .filter(item -> actualStockMin == null || intValue(item.get("actualStock"), 0) >= actualStockMin)
            .filter(item -> actualStockMax == null || intValue(item.get("actualStock"), 0) <= actualStockMax)
            .toList();
        int total = filtered.size();
        int from = Math.min((safePage - 1) * safePageSize, total);
        int to = Math.min(from + safePageSize, total);
        return row(
            "list", filtered.subList(from, to),
            "total", total,
            "page", safePage,
            "pageSize", safePageSize
        );
    }

    @GetMapping("/{skuId}/reservations")
    public Map<String, Object> reservations(@PathVariable String skuId) {
        return row("list", List.of());
    }

    @GetMapping("/{skuId}/logs")
    public Map<String, Object> logs(
        @PathVariable String skuId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(required = false) String changeType,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate
    ) {
        SkuRef ref = parseSkuId(skuId);
        int safePage = Math.max(1, page);
        int safePageSize = Math.min(50, Math.max(1, pageSize));
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("productId", ref.productId());
        StringBuilder where = new StringBuilder(" WHERE im.product_id = :productId");
        if (changeType != null && !changeType.isBlank()) {
            where.append(" AND im.movement_type IN (:changeTypes)");
            params.put("changeTypes", movementTypeFilters(changeType.trim()));
        }
        if (startDate != null && !startDate.isBlank()) {
            where.append(" AND im.created_at >= :startDate");
            params.put("startDate", startDate.trim() + " 00:00:00");
        }
        if (endDate != null && !endDate.isBlank()) {
            where.append(" AND im.created_at <= :endDate");
            params.put("endDate", endDate.trim() + " 23:59:59");
        }
        Long total = jdbcClient.sql("SELECT COUNT(*) FROM inventory_movements im" + where)
            .params(params)
            .query(Long.class)
            .single();
        params.put("limit", safePageSize);
        params.put("offset", (safePage - 1) * safePageSize);
        List<Map<String, Object>> rows = jdbcClient.sql("""
                SELECT im.id, im.created_at AS change_time, im.movement_type AS change_type,
                       im.quantity_delta AS change_quantity,
                       im.stock_after - im.quantity_delta AS before_stock,
                       im.stock_after AS after_stock, im.source_type AS related_biz_type,
                       im.source_no AS related_biz_no, '系统' AS operator_name, im.remark
                FROM inventory_movements im
                """ + where + " ORDER BY im.id DESC LIMIT :limit OFFSET :offset")
            .params(params)
            .query(this::mapRow)
            .list()
            .stream()
            .map(item -> {
                item.put("changeType", normalizeMovementType(string(item.get("changeType"))));
                return item;
            })
            .toList();
        return row("list", rows, "total", total == null ? 0 : total, "page", safePage, "pageSize", safePageSize);
    }

    @PostMapping("/{skuId}/adjust")
    @Transactional
    public Map<String, Object> adjust(@PathVariable String skuId, @RequestBody Map<String, Object> request) {
        SkuRef ref = parseSkuId(skuId);
        String operatorName = requireOperator(request);
        String adjustType = string(request.getOrDefault("adjustType", "INCREASE")).trim().toUpperCase();
        int quantity = positiveInt(request, "quantity");
        int delta = "DECREASE".equals(adjustType) ? -quantity : quantity;
        String reason = string(request.get("reason")).trim();
        if (reason.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "调整原因不能为空");
        }
        ProductStock product = loadProductStock(ref.productId());
        List<Map<String, Object>> skuRows = parseSkuRows(product.skuListJson());
        int beforeStock = skuStock(product, skuRows, ref.specIndex());
        int afterStock = beforeStock + delta;
        if (afterStock < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "调整后实际库存不能小于0");
        }
        String nextSkuListJson = updateSkuStockJson(skuRows, ref.specIndex(), afterStock);
        int productStockAfter = productStockAfter(product.stockQuantity(), skuRows, ref.specIndex(), afterStock);
        jdbcClient.sql("""
            UPDATE products
            SET stock_quantity = :stockQuantity, sku_list_json = :skuListJson
            WHERE id = :productId
            """)
            .param("stockQuantity", productStockAfter)
            .param("skuListJson", nextSkuListJson)
            .param("productId", ref.productId())
            .update();
        String adjustmentNo = "ADJ" + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO inventory_movements (product_id, movement_type, quantity_delta, stock_after, source_type, source_no, remark)
            VALUES (:productId, 'MANUAL_ADJUST', :quantityDelta, :stockAfter, 'INVENTORY_ADJUSTMENT', :sourceNo, :remark)
            """)
            .param("productId", ref.productId())
            .param("quantityDelta", delta)
            .param("stockAfter", afterStock)
            .param("sourceNo", adjustmentNo)
            .param("remark", reason + "：" + string(request.getOrDefault("remark", "")))
            .update();
        logAs(operatorName, "库存管理", "库存调整", adjustmentNo, "SKU " + skuId + " 库存调整 " + delta);
        return row("adjustmentNo", adjustmentNo, "skuId", skuId, "beforeStock", beforeStock, "afterStock", afterStock);
    }

    @PostMapping("/{skuId}/warning")
    @Transactional
    public Map<String, Object> warning(@PathVariable String skuId, @RequestBody Map<String, Object> request) {
        SkuRef ref = parseSkuId(skuId);
        String operatorName = requireOperator(request);
        int warningStock = nonNegativeInt(request, "warningStock");
        updateWarning(ref, warningStock);
        logAs(operatorName, "库存管理", "设置库存预警", skuId, "设置预警值为 " + warningStock);
        return row("skuId", skuId, "warningStock", warningStock);
    }

    @PostMapping("/warning/batch")
    @Transactional
    public Map<String, Object> batchWarning(@RequestBody Map<String, Object> request) {
        String operatorName = requireOperator(request);
        int warningStock = nonNegativeInt(request, "warningStock");
        Object rawIds = request.get("skuIds");
        if (!(rawIds instanceof List<?> values) || values.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请先选择需要设置预警的SKU");
        }
        for (Object value : values) {
            updateWarning(parseSkuId(String.valueOf(value)), warningStock);
        }
        logAs(operatorName, "库存管理", "批量设置库存预警", "inventory-warning", "批量设置 " + values.size() + " 个SKU预警值为 " + warningStock);
        return row("updated", values.size(), "warningStock", warningStock);
    }

    private List<Map<String, Object>> inventoryRows() {
        List<Map<String, Object>> products = jdbcClient.sql("""
                SELECT p.id AS product_id, p.product_code, p.product_name, p.category_name, c.id AS category_id,
                       p.brand_name, b.id AS brand_id,
                       CASE WHEN p.product_status = 'NEW' AND p.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
                            THEN 'NORMAL' ELSE p.product_status END AS product_status,
                       p.sale_status, p.unit,
                       CASE WHEN LOWER(COALESCE(p.main_image_thumbnail_url, '')) LIKE 'data:image%' THEN '' ELSE COALESCE(p.main_image_thumbnail_url, '') END AS product_image,
                       p.main_image_url, p.stock_quantity, p.inventory_warning_stock, p.sku_list_json,
                       p.pinyin_code, p.pinyin_full, p.initial_code
                FROM products p
                LEFT JOIN product_categories c ON c.category_name = p.category_name
                LEFT JOIN product_brands b ON b.brand_name = p.brand_name
                ORDER BY p.id DESC
                """)
            .query(this::mapRow)
            .list();
        Map<String, Integer> sales7d = salesQuantityMap(7);
        Map<String, Integer> sales30d = salesQuantityMap(30);
        Map<Long, String> lastInbound = movementTimeMap(Set.of("PURCHASE_STOCK_IN", "INBOUND", "RETURN_STOCK_IN"), true);
        Map<Long, String> lastOutbound = movementTimeMap(Set.of("ORDER_DEDUCT", "OUTBOUND"), false);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> product : products) {
            List<Map<String, Object>> skuRows = parseSkuRows(string(product.get("skuListJson")));
            if (skuRows.isEmpty()) {
                skuRows = List.of(Map.of(
                    "skuCode", "SKU" + product.get("productCode"),
                    "skuName", "-",
                    "stockQuantity", product.get("stockQuantity")
                ));
            }
            for (int index = 0; index < skuRows.size(); index++) {
                Map<String, Object> sku = skuRows.get(index);
                Long productId = longValue(product.get("productId"));
                String skuCode = skuString(sku, "skuCode", "SKU" + product.get("productCode"));
                int actualStock = intValue(sku.get("stockQuantity"), intValue(product.get("stockQuantity"), 0));
                int frozenStock = 0;
                int availableStock = actualStock - frozenStock;
                Integer warningStock = nullableInt(firstPresent(sku.get("warningStock"), product.get("inventoryWarningStock")));
                int sales7 = sales7d.getOrDefault(productId + "|" + skuCode, sales7d.getOrDefault(String.valueOf(productId), 0));
                int sales30 = sales30d.getOrDefault(productId + "|" + skuCode, sales30d.getOrDefault(String.valueOf(productId), 0));
                String status = stockStatus(actualStock, frozenStock, availableStock, warningStock);
                result.add(row(
                    "skuId", productId + "-" + index,
                    "productId", productId,
                    "productCode", product.get("productCode"),
                    "productName", product.get("productName"),
                    "productImage", safeImage(firstPresent(product.get("productImage"), product.get("mainImageUrl"))),
                    "productStatus", product.get("productStatus"),
                    "saleStatus", product.get("saleStatus"),
                    "categoryId", product.get("categoryId"),
                    "categoryName", product.get("categoryName"),
                    "brandId", product.get("brandId"),
                    "brandName", product.get("brandName"),
                    "skuCode", skuCode,
                    "skuName", skuString(sku, "skuName", "默认规格"),
                    "unit", skuString(sku, "unit", string(product.get("unit"))),
                    "actualStock", actualStock,
                    "frozenStock", frozenStock,
                    "availableStock", availableStock,
                    "warningStock", warningStock,
                    "stockStatus", status,
                    "abnormal", isAbnormal(actualStock, frozenStock, availableStock),
                    "sales7d", sales7,
                    "sales30d", sales30,
                    "estimatedSaleDays", estimatedSaleDays(availableStock, sales7),
                    "lastInboundTime", lastInbound.get(productId),
                    "lastOutboundTime", lastOutbound.get(productId),
                    "pinyinCode", product.get("pinyinCode"),
                    "pinyinFull", product.get("pinyinFull"),
                    "initialCode", product.get("initialCode")
                ));
            }
        }
        return result;
    }

    private long countStatus(List<Map<String, Object>> rows, String status) {
        return rows.stream().filter(item -> status.equals(item.get("stockStatus"))).count();
    }

    private long todayOutboundQuantity() {
        Integer value = jdbcClient.sql("""
            SELECT COALESCE(SUM(ABS(quantity_delta)), 0)
            FROM inventory_movements
            WHERE quantity_delta < 0
              AND DATE(created_at) = CURRENT_DATE()
            """)
            .query(Integer.class)
            .single();
        return value == null ? 0 : value;
    }

    private Map<String, Integer> salesQuantityMap(int days) {
        Map<String, Integer> result = new LinkedHashMap<>();
        List<Map<String, Object>> rows = jdbcClient.sql("""
                SELECT product_id, sku_code, COALESCE(SUM(quantity), 0) AS quantity
                FROM sales_order_items
                WHERE created_at >= :startTime
                GROUP BY product_id, sku_code
                """)
            .param("startTime", LocalDateTime.now().minusDays(days))
            .query(this::mapRow)
            .list();
        for (Map<String, Object> item : rows) {
            Long productId = longValue(item.get("productId"));
            int quantity = intValue(item.get("quantity"), 0);
            result.put(productId + "|" + string(item.get("skuCode")), quantity);
            result.put(String.valueOf(productId), result.getOrDefault(String.valueOf(productId), 0) + quantity);
        }
        return result;
    }

    private Map<Long, String> movementTimeMap(Set<String> types, boolean inbound) {
        if (types.isEmpty()) return Map.of();
        List<Map<String, Object>> rows = jdbcClient.sql("""
                SELECT product_id, MAX(created_at) AS latest_time
                FROM inventory_movements
                WHERE movement_type IN (:types)
                   OR (:inbound = true AND quantity_delta > 0)
                   OR (:inbound = false AND quantity_delta < 0)
                GROUP BY product_id
                """)
            .param("types", types)
            .param("inbound", inbound)
            .query(this::mapRow)
            .list();
        Map<Long, String> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            result.put(longValue(row.get("productId")), dateText(row.get("latestTime")));
        }
        return result;
    }

    private String stockStatus(int actualStock, int frozenStock, int availableStock, Integer warningStock) {
        if (actualStock < 0 || (availableStock < 0 && frozenStock <= actualStock)) return "NEGATIVE";
        if (frozenStock > actualStock) return "FROZEN_ABNORMAL";
        if (availableStock == 0) return "OUT_OF_STOCK";
        if (warningStock == null) return "WARNING_NOT_SET";
        if (availableStock > 0 && availableStock <= warningStock) return "WARNING";
        if (frozenStock > 0) return "FROZEN";
        return "NORMAL";
    }

    private boolean matchesKeyword(Map<String, Object> item, String keyword) {
        String value = string(keyword).trim().toLowerCase();
        if (value.isBlank()) return true;
        return List.of("productName", "productId", "skuCode", "pinyinCode", "pinyinFull", "initialCode").stream()
            .map(key -> string(item.get(key)).toLowerCase())
            .anyMatch(text -> text.contains(value));
    }

    private boolean belowWarning(Map<String, Object> item) {
        Integer warningStock = nullableInt(item.get("warningStock"));
        return warningStock != null && intValue(item.get("availableStock"), 0) <= warningStock;
    }

    private boolean isAbnormal(Map<String, Object> item) {
        return isAbnormal(intValue(item.get("actualStock"), 0), intValue(item.get("frozenStock"), 0), intValue(item.get("availableStock"), 0));
    }

    private boolean isAbnormal(int actualStock, int frozenStock, int availableStock) {
        return actualStock < 0 || availableStock < 0 || frozenStock > actualStock;
    }

    private Object estimatedSaleDays(int availableStock, int sales7d) {
        if (availableStock == 0) return 0;
        if (sales7d <= 0) return null;
        return Math.max(1, Math.round(availableStock / (sales7d / 7.0)));
    }

    private void updateWarning(SkuRef ref, int warningStock) {
        ProductStock product = loadProductStock(ref.productId());
        List<Map<String, Object>> skuRows = parseSkuRows(product.skuListJson());
        if (!skuRows.isEmpty() && ref.specIndex() >= 0 && ref.specIndex() < skuRows.size()) {
            skuRows.get(ref.specIndex()).put("warningStock", warningStock);
        }
        jdbcClient.sql("""
            UPDATE products
            SET inventory_warning_stock = :warningStock,
                sku_list_json = :skuListJson
            WHERE id = :productId
            """)
            .param("warningStock", warningStock)
            .param("skuListJson", skuRows.isEmpty() ? product.skuListJson() : json(skuRows))
            .param("productId", ref.productId())
            .update();
    }

    private ProductStock loadProductStock(Long productId) {
        Map<String, Object> row = jdbcClient.sql("""
                SELECT id, stock_quantity, sku_list_json
                FROM products
                WHERE id = :productId
                """)
            .param("productId", productId)
            .query(this::mapRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "商品不存在"));
        return new ProductStock(productId, intValue(row.get("stockQuantity"), 0), string(row.get("skuListJson")));
    }

    private int skuStock(ProductStock product, List<Map<String, Object>> skuRows, int specIndex) {
        if (specIndex >= 0 && specIndex < skuRows.size()) {
            return intValue(skuRows.get(specIndex).get("stockQuantity"), product.stockQuantity());
        }
        return product.stockQuantity();
    }

    private String updateSkuStockJson(List<Map<String, Object>> skuRows, int specIndex, int afterStock) {
        if (skuRows.isEmpty() || specIndex < 0 || specIndex >= skuRows.size()) {
            return json(skuRows);
        }
        skuRows.get(specIndex).put("stockQuantity", afterStock);
        return json(skuRows);
    }

    private int productStockAfter(int fallback, List<Map<String, Object>> skuRows, int specIndex, int afterStock) {
        if (skuRows.isEmpty()) return afterStock;
        if (specIndex >= 0 && specIndex < skuRows.size()) {
            skuRows.get(specIndex).put("stockQuantity", afterStock);
        }
        return skuRows.stream()
            .filter(row -> !"DISABLED".equalsIgnoreCase(string(row.get("skuStatus"))))
            .map(row -> intValue(row.get("stockQuantity"), 0))
            .reduce(0, Integer::sum);
    }

    private SkuRef parseSkuId(String value) {
        String[] parts = string(value).split("-");
        try {
            Long productId = Long.parseLong(parts[0]);
            int specIndex = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
            if (productId <= 0 || specIndex < 0) throw new NumberFormatException();
            return new SkuRef(productId, specIndex);
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SKU标识格式不正确");
        }
    }

    private String requireOperator(Map<String, Object> request) {
        String operatorName = string(request.get("operatorName")).trim();
        if (operatorName.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "无法获取当前操作人，请重新登录");
        }
        Long exists = jdbcClient.sql("SELECT COUNT(*) FROM admin_accounts WHERE account_name = :operatorName")
            .param("operatorName", operatorName)
            .query(Long.class)
            .single();
        if (exists == null || exists <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "operatorName must be an existing admin account");
        }
        return operatorName;
    }

    private List<Map<String, Object>> parseSkuRows(String raw) {
        if (raw == null || raw.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(raw, SKU_LIST_TYPE);
        } catch (JsonProcessingException exception) {
            return new ArrayList<>();
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "数据序列化失败");
        }
    }

    private String lookupName(String table, String column, Long id) {
        if (!Set.of("product_categories", "product_brands").contains(table)) return "";
        if (!Set.of("category_name", "brand_name").contains(column)) return "";
        return jdbcClient.sql("SELECT " + column + " FROM " + table + " WHERE id = :id")
            .param("id", id)
            .query(String.class)
            .optional()
            .orElse("");
    }

    private String normalizeMovementType(String value) {
        return switch (value) {
            case "PURCHASE_STOCK_IN" -> "INBOUND";
            case "ORDER_CANCEL_RELEASE" -> "ORDER_RELEASE";
            case "RETURN_STOCK_IN" -> "RETURN_INBOUND";
            default -> value;
        };
    }

    private List<String> movementTypeFilters(String value) {
        return switch (value) {
            case "INBOUND" -> List.of("INBOUND", "PURCHASE_STOCK_IN");
            case "ORDER_RELEASE" -> List.of("ORDER_RELEASE", "ORDER_CANCEL_RELEASE");
            case "RETURN_INBOUND" -> List.of("RETURN_INBOUND", "RETURN_STOCK_IN");
            default -> List.of(value);
        };
    }

    private String skuString(Map<String, Object> sku, String field, String fallback) {
        String value = string(sku.get(field)).trim();
        return value.isBlank() ? fallback : value;
    }

    private String safeImage(Object value) {
        String text = string(value).trim();
        return text.toLowerCase().startsWith("data:image") ? "" : text;
    }

    private Object firstPresent(Object... values) {
        for (Object value : values) {
            if (value != null && !string(value).isBlank()) return value;
        }
        return null;
    }

    private Integer nullableInt(Object value) {
        if (value == null || string(value).isBlank()) return null;
        try {
            return number(value).intValue();
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private int positiveInt(Map<String, Object> request, String field) {
        int value = requiredInt(request, field);
        if (value <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be greater than zero");
        return value;
    }

    private int nonNegativeInt(Map<String, Object> request, String field) {
        int value = requiredInt(request, field);
        if (value < 0) throw new ApiException(HttpStatus.BAD_REQUEST, field + " cannot be negative");
        return value;
    }

    private int requiredInt(Map<String, Object> request, String field) {
        if (!request.containsKey(field) || request.get(field) == null || string(request.get(field)).isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        try {
            return number(request.get(field)).intValue();
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be a number");
        }
    }

    private Number number(Object value) {
        if (value instanceof Number number) return number;
        return new BigDecimal(String.valueOf(value));
    }

    private int intValue(Object value, int fallback) {
        if (value == null || string(value).isBlank()) return fallback;
        try {
            return number(value).intValue();
        } catch (RuntimeException exception) {
            return fallback;
        }
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        return Long.parseLong(String.valueOf(value));
    }

    private String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String dateText(Object value) {
        if (value == null) return null;
        return String.valueOf(value).replace("T", " ").substring(0, Math.min(19, String.valueOf(value).length()));
    }

    private void logAs(String operatorName, String module, String operation, String relatedNo, String content) {
        String logNo = "LOG" + LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO operation_logs (log_no, operator_name, module_name, operation_name, related_no, operation_content, operation_result)
            VALUES (:logNo, :operatorName, :module, :operation, :relatedNo, :content, 'SUCCESS')
            """)
            .param("logNo", logNo)
            .param("operatorName", operatorName)
            .param("module", module)
            .param("operation", operation)
            .param("relatedNo", relatedNo)
            .param("content", content)
            .update();
    }

    private Map<String, Object> mapRow(ResultSet rs, int rowNum) throws SQLException {
        ResultSetMetaData metaData = rs.getMetaData();
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 1; i <= metaData.getColumnCount(); i++) {
            result.put(toCamelCase(metaData.getColumnLabel(i)), rs.getObject(i));
        }
        return result;
    }

    private String toCamelCase(String value) {
        StringBuilder builder = new StringBuilder();
        boolean upperNext = false;
        for (char ch : value.toCharArray()) {
            if (ch == '_') {
                upperNext = true;
            } else if (upperNext) {
                builder.append(Character.toUpperCase(ch));
                upperNext = false;
            } else {
                builder.append(Character.toLowerCase(ch));
            }
        }
        return builder.toString();
    }

    private Map<String, Object> row(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }

    private record SkuRef(Long productId, int specIndex) {}
    private record ProductStock(Long productId, int stockQuantity, String skuListJson) {}
}
