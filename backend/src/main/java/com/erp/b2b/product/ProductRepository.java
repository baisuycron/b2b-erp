package com.erp.b2b.product;

import com.erp.b2b.common.ApiException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class ProductRepository {
    private static final int MAX_PRODUCT_NAME_LENGTH = 30;
    private static final int MAX_UNIT_LENGTH = 10;
    private static final int MAX_SKU_TEXT_LENGTH = 18;
    private static final int MAX_SPEC_TYPE_LENGTH = 20;
    private static final int MAX_SPEC_VALUE_LENGTH = 10;
    private static final int MAX_SPEC_VALUES_PER_GROUP = 5;
    private static final int MAX_STOCK = 999999;
    private static final int MAX_MIN_ORDER_QUANTITY = 100;
    private static final int MAX_SALE_UNIT_LENGTH = 10;
    private static final BigDecimal MAX_PRICE = new BigDecimal("99999.99");

    private final JdbcClient jdbcClient;
    private final ProductSearchCodeGenerator searchCodeGenerator;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ProductRepository(JdbcClient jdbcClient, ProductSearchCodeGenerator searchCodeGenerator) {
        this.jdbcClient = jdbcClient;
        this.searchCodeGenerator = searchCodeGenerator;
    }

    public List<Product> findAll() {
        return jdbcClient.sql("""
            SELECT id, product_code, sku_barcode, pinyin_code, pinyin_full, initial_code, product_name, category_name, brand_name, attribute_template_id, custom_attributes_json, sku_name, sku_status, unit,
                   quote_type, sale_mode, sale_unit, sale_unit_ratio, main_image_url, detail_content, sale_price, stock_quantity,
                   min_order_quantity, sku_list_json, tier_prices_json, sale_status, created_at, updated_at
            FROM products
            ORDER BY id DESC
            """)
            .query(this::mapProduct)
            .list();
    }

    public List<ProductListItem> findAdminList() {
        return jdbcClient.sql("""
            SELECT id, product_code, sku_barcode, product_name, category_name, brand_name,
                   sku_name, unit, quote_type, sale_price, stock_quantity, sale_status,
                   main_image_thumbnail_url, updated_at
            FROM products
            ORDER BY id DESC
            """)
            .query((rs, rowNum) -> new ProductListItem(
                rs.getLong("id"),
                rs.getString("product_code"),
                rs.getString("sku_barcode"),
                rs.getString("product_name"),
                rs.getString("category_name"),
                rs.getString("brand_name"),
                rs.getString("sku_name"),
                rs.getString("unit"),
                rs.getString("quote_type"),
                rs.getBigDecimal("sale_price"),
                rs.getInt("stock_quantity"),
                rs.getString("sale_status"),
                rs.getString("main_image_thumbnail_url"),
                rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime()
            ))
            .list();
    }

    public Optional<Product> findById(Long id) {
        return jdbcClient.sql("""
            SELECT id, product_code, sku_barcode, pinyin_code, pinyin_full, initial_code, product_name, category_name, brand_name, attribute_template_id, custom_attributes_json, sku_name, sku_status, unit,
                   quote_type, sale_mode, sale_unit, sale_unit_ratio, main_image_url, detail_content, sale_price, stock_quantity,
                   min_order_quantity, sku_list_json, tier_prices_json, sale_status, created_at, updated_at
            FROM products
            WHERE id = :id
            """)
            .param("id", id)
            .query(this::mapProduct)
            .optional();
    }

    public String findMainImageThumbnailUrl(Long id) {
        return jdbcClient.sql("""
            SELECT COALESCE(main_image_thumbnail_url, '')
            FROM products
            WHERE id = :id
            """)
            .param("id", id)
            .query(String.class)
            .optional()
            .orElse("");
    }

    public List<Product> findMallProducts(String keyword, Long categoryId, String categoryName, Long brandId, String brandName) {
        String resolvedCategoryName = clean(categoryName, "");
        if (categoryId != null) {
            resolvedCategoryName = jdbcClient.sql("""
                SELECT category_name
                FROM product_categories
                WHERE id = :categoryId
                  AND category_status = 'ENABLED'
                """)
                .param("categoryId", categoryId)
                .query(String.class)
                .optional()
                .orElse(resolvedCategoryName);
        }
        String resolvedBrandName = clean(brandName, "");
        if (brandId != null) {
            resolvedBrandName = jdbcClient.sql("""
                SELECT brand_name
                FROM product_brands
                WHERE id = :brandId
                  AND brand_status = 'ENABLED'
                """)
                .param("brandId", brandId)
                .query(String.class)
                .optional()
                .orElse(resolvedBrandName);
        }

        String text = clean(keyword, "").toLowerCase();
        String likeKeyword = "%" + text + "%";
        return jdbcClient.sql("""
            SELECT id, product_code, sku_barcode, pinyin_code, pinyin_full, initial_code, product_name, category_name, brand_name, attribute_template_id, custom_attributes_json, sku_name, sku_status, unit,
                   quote_type, sale_mode, sale_unit, sale_unit_ratio, main_image_url, NULL AS detail_content, sale_price, stock_quantity,
                   min_order_quantity, sku_list_json, tier_prices_json, sale_status, created_at, updated_at
            FROM products
            WHERE sale_status = 'ON_SALE'
              AND (:categoryName = '' OR category_name = :categoryName)
              AND (:brandName = '' OR brand_name = :brandName)
              AND (
                :keyword = ''
                OR LOWER(product_name) LIKE :likeKeyword
                OR LOWER(COALESCE(pinyin_code, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(pinyin_full, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(initial_code, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(sku_barcode, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(sku_list_json, '')) LIKE :likeKeyword
              )
            ORDER BY id DESC
            """)
            .param("categoryName", resolvedCategoryName)
            .param("brandName", resolvedBrandName)
            .param("keyword", text)
            .param("likeKeyword", likeKeyword)
            .query(this::mapProduct)
            .list();
    }

    public List<MallProductListItem> findMallProductList(String keyword, Long categoryId, String categoryName, Long brandId, String brandName) {
        String resolvedCategoryName = clean(categoryName, "");
        if (categoryId != null) {
            resolvedCategoryName = jdbcClient.sql("""
                SELECT category_name
                FROM product_categories
                WHERE id = :categoryId
                  AND category_status = 'ENABLED'
                """)
                .param("categoryId", categoryId)
                .query(String.class)
                .optional()
                .orElse(resolvedCategoryName);
        }
        String resolvedBrandName = clean(brandName, "");
        if (brandId != null) {
            resolvedBrandName = jdbcClient.sql("""
                SELECT brand_name
                FROM product_brands
                WHERE id = :brandId
                  AND brand_status = 'ENABLED'
                """)
                .param("brandId", brandId)
                .query(String.class)
                .optional()
                .orElse(resolvedBrandName);
        }

        String text = clean(keyword, "").toLowerCase();
        String likeKeyword = "%" + text + "%";
        return jdbcClient.sql("""
            SELECT id, product_code, sku_barcode, product_name, category_name, brand_name,
                   sku_name, unit, quote_type, sale_mode, sale_unit, sale_unit_ratio, sale_price,
                   stock_quantity, min_order_quantity, sale_status,
                   CASE
                     WHEN LOWER(COALESCE(main_image_card_url, '')) LIKE 'data:image%' THEN ''
                     ELSE COALESCE(main_image_card_url, '')
                   END AS main_image_card_url,
                   CASE
                     WHEN LOWER(COALESCE(main_image_thumbnail_url, '')) LIKE 'data:image%' THEN ''
                     ELSE COALESCE(main_image_thumbnail_url, '')
                   END AS main_image_thumbnail_url,
                   updated_at
            FROM products
            WHERE sale_status = 'ON_SALE'
              AND (:categoryName = '' OR category_name = :categoryName)
              AND (:brandName = '' OR brand_name = :brandName)
              AND (
                :keyword = ''
                OR LOWER(product_name) LIKE :likeKeyword
                OR LOWER(COALESCE(pinyin_code, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(pinyin_full, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(initial_code, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(sku_barcode, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(sku_list_json, '')) LIKE :likeKeyword
              )
            ORDER BY id DESC
            """)
            .param("categoryName", resolvedCategoryName)
            .param("brandName", resolvedBrandName)
            .param("keyword", text)
            .param("likeKeyword", likeKeyword)
            .query((rs, rowNum) -> new MallProductListItem(
                rs.getLong("id"),
                rs.getString("product_code"),
                rs.getString("sku_barcode"),
                rs.getString("product_name"),
                rs.getString("category_name"),
                rs.getString("brand_name"),
                rs.getString("sku_name"),
                rs.getString("unit"),
                rs.getString("quote_type"),
                rs.getString("sale_mode"),
                rs.getString("sale_unit"),
                rs.getObject("sale_unit_ratio", Integer.class),
                rs.getBigDecimal("sale_price"),
                rs.getObject("stock_quantity", Integer.class),
                rs.getObject("min_order_quantity", Integer.class),
                rs.getString("sale_status"),
                rs.getString("main_image_card_url"),
                rs.getString("main_image_thumbnail_url"),
                rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime()
            ))
            .list();
    }

    public List<Product> searchMallProductsForAssistant(String keyword, int limit) {
        String text = clean(keyword, "").toLowerCase();
        if (text.isBlank()) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 5));
        String likeKeyword = "%" + text + "%";
        return jdbcClient.sql("""
            SELECT id, product_code, sku_barcode, pinyin_code, pinyin_full, initial_code, product_name, category_name, brand_name, attribute_template_id, custom_attributes_json, sku_name, sku_status, unit,
                   quote_type, sale_mode, sale_unit, sale_unit_ratio, main_image_url, detail_content, sale_price, stock_quantity,
                   min_order_quantity, sku_list_json, tier_prices_json, sale_status, created_at, updated_at
            FROM products
            WHERE sale_status = 'ON_SALE'
              AND (
                LOWER(product_name) LIKE :likeKeyword
                OR LOWER(COALESCE(category_name, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(brand_name, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(pinyin_code, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(pinyin_full, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(initial_code, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(sku_barcode, '')) LIKE :likeKeyword
                OR LOWER(COALESCE(sku_list_json, '')) LIKE :likeKeyword
              )
            ORDER BY
              CASE
                WHEN LOWER(product_name) LIKE :likeKeyword THEN 0
                WHEN LOWER(COALESCE(brand_name, '')) LIKE :likeKeyword THEN 1
                WHEN LOWER(COALESCE(category_name, '')) LIKE :likeKeyword THEN 2
                ELSE 3
              END,
              stock_quantity DESC,
              id DESC
            LIMIT :limit
            """)
            .param("likeKeyword", likeKeyword)
            .param("limit", safeLimit)
            .query(this::mapProduct)
            .list();
    }

    public List<String> listSpecTypes() {
        return jdbcClient.sql("""
            SELECT spec_name
            FROM product_spec_types
            ORDER BY sort_no ASC, id ASC
            """)
            .query(String.class)
            .list();
    }

    public Long findCategoryIdByName(String categoryName) {
        return jdbcClient.sql("""
            SELECT id
            FROM product_categories
            WHERE category_name = :categoryName
            LIMIT 1
            """)
            .param("categoryName", clean(categoryName, ""))
            .query(Long.class)
            .optional()
            .orElse(null);
    }

    public Long findBrandIdByName(String brandName) {
        return jdbcClient.sql("""
            SELECT id
            FROM product_brands
            WHERE brand_name = :brandName
            LIMIT 1
            """)
            .param("brandName", clean(brandName, ""))
            .query(Long.class)
            .optional()
            .orElse(null);
    }

    public String createSpecType(String name) {
        String normalized = clean(name, "");
        if (normalized.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "规格类型不能为空");
        }
        if (normalized.length() > MAX_SPEC_TYPE_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "规格类型不能超过20个字符");
        }

        Optional<String> existing = jdbcClient.sql("""
            SELECT spec_name
            FROM product_spec_types
            WHERE LOWER(spec_name) = LOWER(:name)
            LIMIT 1
            """)
            .param("name", normalized)
            .query(String.class)
            .optional();
        if (existing.isPresent()) {
            return existing.get();
        }

        Integer sortNo = jdbcClient.sql("""
            SELECT COALESCE(MAX(sort_no), 0) + 1
            FROM product_spec_types
            """)
            .query(Integer.class)
            .single();

        jdbcClient.sql("""
            INSERT INTO product_spec_types (spec_name, sort_no, status)
            VALUES (:name, :sortNo, 'ENABLED')
            """)
            .param("name", normalized)
            .param("sortNo", sortNo == null ? 1 : sortNo)
            .update();
        return normalized;
    }

    @Transactional
    public Product create(CreateProductRequest request) {
        String productCode = reserveNextProductCode();
        ProductPayload payload = normalizePayload(request, "SKU" + productCode, "ON_SALE");
        ProductSearchCodeGenerator.SearchCodes searchCodes = searchCodeGenerator.generate(payload.productName());
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("""
            INSERT INTO products (
                product_code, sku_barcode, pinyin_code, pinyin_full, initial_code, product_name, category_name, brand_name, attribute_template_id, custom_attributes_json, sku_name, sku_status, unit,
                quote_type, sale_mode, sale_unit, sale_unit_ratio, main_image_url, detail_content, sale_price, stock_quantity,
                min_order_quantity, sku_list_json, tier_prices_json, sale_status
            )
            VALUES (
                :productCode, :skuBarcode, :pinyinCode, :pinyinFull, :initialCode, :productName, :categoryName, :brandName, :attributeTemplateId, :customAttributesJson, :skuName, :skuStatus, :unit,
                :quoteType, :saleMode, :saleUnit, :saleUnitRatio, :mainImageUrl, :detailContent, :salePrice, :stockQuantity,
                :minOrderQuantity, :skuListJson, :tierPricesJson, :saleStatus
            )
            """)
            .param("productCode", productCode)
            .param("skuBarcode", payload.skuBarcode())
            .param("pinyinCode", searchCodes.pinyinCode())
            .param("pinyinFull", searchCodes.pinyinFull())
            .param("initialCode", searchCodes.initialCode())
            .param("productName", payload.productName())
            .param("categoryName", payload.categoryName())
            .param("brandName", payload.brandName())
            .param("attributeTemplateId", payload.attributeTemplateId())
            .param("customAttributesJson", payload.customAttributesJson())
            .param("skuName", payload.skuName())
            .param("skuStatus", payload.skuStatus())
            .param("unit", payload.unit())
            .param("quoteType", payload.quoteType())
            .param("saleMode", payload.saleMode())
            .param("saleUnit", payload.saleUnit())
            .param("saleUnitRatio", payload.saleUnitRatio())
            .param("mainImageUrl", payload.mainImageUrl())
            .param("detailContent", payload.detailContent())
            .param("salePrice", payload.salePrice())
            .param("stockQuantity", payload.stockQuantity())
            .param("minOrderQuantity", payload.minOrderQuantity())
            .param("skuListJson", payload.skuListJson())
            .param("tierPricesJson", payload.tierPricesJson())
            .param("saleStatus", payload.saleStatus())
            .update(keyHolder, "id");
        Long id = keyHolder.getKey().longValue();
        return findById(id).orElseThrow();
    }

    public Product update(Long productId, CreateProductRequest request) {
        Product existing = findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "商品不存在"));
        ProductPayload payload = normalizePayload(request, primarySkuCode(existing), existing.saleStatus());
        ProductSearchCodeGenerator.SearchCodes searchCodes = searchCodeGenerator.generate(payload.productName());
        jdbcClient.sql("""
            UPDATE products
            SET product_name = :productName,
                pinyin_code = :pinyinCode,
                pinyin_full = :pinyinFull,
                initial_code = :initialCode,
                category_name = :categoryName,
                brand_name = :brandName,
                attribute_template_id = :attributeTemplateId,
                custom_attributes_json = :customAttributesJson,
                sku_barcode = :skuBarcode,
                sku_name = :skuName,
                sku_status = :skuStatus,
                unit = :unit,
                quote_type = :quoteType,
                sale_mode = :saleMode,
                sale_unit = :saleUnit,
                sale_unit_ratio = :saleUnitRatio,
                main_image_url = :mainImageUrl,
                detail_content = :detailContent,
                sale_price = :salePrice,
                stock_quantity = :stockQuantity,
                min_order_quantity = :minOrderQuantity,
                sku_list_json = :skuListJson,
                tier_prices_json = :tierPricesJson,
                sale_status = :saleStatus
            WHERE id = :productId
            """)
            .param("productId", productId)
            .param("productName", payload.productName())
            .param("pinyinCode", searchCodes.pinyinCode())
            .param("pinyinFull", searchCodes.pinyinFull())
            .param("initialCode", searchCodes.initialCode())
            .param("categoryName", payload.categoryName())
            .param("brandName", payload.brandName())
            .param("attributeTemplateId", payload.attributeTemplateId())
            .param("customAttributesJson", payload.customAttributesJson())
            .param("skuBarcode", payload.skuBarcode())
            .param("skuName", payload.skuName())
            .param("skuStatus", payload.skuStatus())
            .param("unit", payload.unit())
            .param("quoteType", payload.quoteType())
            .param("saleMode", payload.saleMode())
            .param("saleUnit", payload.saleUnit())
            .param("saleUnitRatio", payload.saleUnitRatio())
            .param("mainImageUrl", payload.mainImageUrl())
            .param("detailContent", payload.detailContent())
            .param("salePrice", payload.salePrice())
            .param("stockQuantity", payload.stockQuantity())
            .param("minOrderQuantity", payload.minOrderQuantity())
            .param("skuListJson", payload.skuListJson())
            .param("tierPricesJson", payload.tierPricesJson())
            .param("saleStatus", payload.saleStatus())
            .update();
        return findById(productId).orElseThrow();
    }

    public int deductStock(Long productId, int quantity) {
        return jdbcClient.sql("""
            UPDATE products
            SET stock_quantity = stock_quantity - :quantity
            WHERE id = :productId
              AND sale_status = 'ON_SALE'
              AND stock_quantity >= :quantity
            """)
            .param("productId", productId)
            .param("quantity", quantity)
            .update();
    }

    public int addStock(Long productId, int quantity) {
        return jdbcClient.sql("""
            UPDATE products
            SET stock_quantity = stock_quantity + :quantity
            WHERE id = :productId
              AND :quantity > 0
            """)
            .param("productId", productId)
            .param("quantity", quantity)
            .update();
    }

    public int setSaleStatus(Long productId, String saleStatus) {
        if ("ON_SALE".equals(saleStatus)) {
            ensureReadyForSale(productId);
        }
        return jdbcClient.sql("""
            UPDATE products
            SET sale_status = :saleStatus
            WHERE id = :productId
            """)
            .param("productId", productId)
            .param("saleStatus", saleStatus)
            .update();
    }

    public int batchUpdateCategory(List<Long> productIds, String categoryName) {
        return jdbcClient.sql("UPDATE products SET category_name = :categoryName WHERE id IN (:productIds)")
            .param("categoryName", categoryName)
            .param("productIds", productIds)
            .update();
    }

    public int batchUpdateBrand(List<Long> productIds, String brandName) {
        return jdbcClient.sql("UPDATE products SET brand_name = :brandName WHERE id IN (:productIds)")
            .param("brandName", brandName)
            .param("productIds", productIds)
            .update();
    }

    public int batchUpdateSaleStatus(List<Long> productIds, String saleStatus) {
        if (!"ON_SALE".equals(saleStatus) && !"OFF_SALE".equals(saleStatus)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "商品状态不正确");
        }
        if ("ON_SALE".equals(saleStatus)) {
            productIds.forEach(this::ensureReadyForSale);
        }
        return jdbcClient.sql("UPDATE products SET sale_status = :saleStatus WHERE id IN (:productIds)")
            .param("saleStatus", saleStatus)
            .param("productIds", productIds)
            .update();
    }

    public int batchUpdateAttributes(
        List<Long> productIds,
        Long attributeTemplateId,
        List<Map<String, Object>> customAttributes
    ) {
        Long normalizedTemplateId = normalizeAttributeTemplateId(attributeTemplateId);
        String customAttributesJson = normalizeCustomAttributes(normalizedTemplateId, customAttributes);
        return jdbcClient.sql("""
            UPDATE products
            SET attribute_template_id = :attributeTemplateId,
                custom_attributes_json = :customAttributesJson
            WHERE id IN (:productIds)
            """)
            .param("attributeTemplateId", normalizedTemplateId)
            .param("customAttributesJson", customAttributesJson)
            .param("productIds", productIds)
            .update();
    }

    private Product mapProduct(ResultSet rs, int rowNum) throws SQLException {
        return new Product(
            rs.getLong("id"),
            rs.getString("product_code"),
            rs.getString("sku_barcode"),
            rs.getString("pinyin_code"),
            rs.getString("pinyin_full"),
            rs.getString("initial_code"),
            rs.getString("product_name"),
            rs.getString("category_name"),
            rs.getString("brand_name"),
            rs.getObject("attribute_template_id", Long.class),
            rs.getString("custom_attributes_json"),
            rs.getString("sku_name"),
            rs.getString("sku_status"),
            rs.getString("unit"),
            rs.getString("quote_type"),
            rs.getString("sale_mode"),
            rs.getString("sale_unit"),
            rs.getObject("sale_unit_ratio", Integer.class),
            rs.getString("main_image_url"),
            rs.getString("detail_content"),
            rs.getBigDecimal("sale_price"),
            rs.getInt("stock_quantity"),
            rs.getInt("min_order_quantity"),
            rs.getString("sku_list_json"),
            rs.getString("tier_prices_json"),
            rs.getString("sale_status"),
            rs.getTimestamp("created_at").toLocalDateTime(),
            rs.getTimestamp("updated_at").toLocalDateTime()
        );
    }

    public String primarySkuCode(Product product) {
        List<Map<String, Object>> rows = parseObjectRows(product.skuListJson());
        if (!rows.isEmpty()) {
            String code = clean(rows.get(0).get("skuCode"), "");
            if (!code.isBlank()) return code;
        }
        return "SKU" + product.productCode();
    }

    private String reserveNextProductCode() {
        Long nextValue = jdbcClient.sql("""
            SELECT next_value
            FROM product_code_sequences
            WHERE sequence_name = 'product'
            FOR UPDATE
            """)
            .query(Long.class)
            .optional()
            .orElseThrow(() -> new IllegalStateException("Product code sequence is not initialized"));
        if (nextValue < 1 || nextValue > 9_999_999) {
            throw new ApiException(HttpStatus.CONFLICT, "商品编码已达到最大值9999999");
        }
        jdbcClient.sql("""
            UPDATE product_code_sequences
            SET next_value = next_value + 1
            WHERE sequence_name = 'product'
            """)
            .update();
        return String.format("%07d", nextValue);
    }

    private void ensureReadyForSale(Long productId) {
        Integer count = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM products
            WHERE id = :productId
              AND COALESCE(category_name, '') <> ''
              AND COALESCE(brand_name, '') <> ''
              AND COALESCE(main_image_url, '') <> ''
              AND sku_status = 'ENABLED'
              AND sale_price > 0
              AND stock_quantity >= 1
              AND min_order_quantity BETWEEN 1 AND 100
            """)
            .param("productId", productId)
            .query(Integer.class)
            .single();
        if (count == null || count <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "商品上架前需补全分类、品牌、主图、启用SKU和报价信息");
        }
    }

    private ProductPayload normalizePayload(CreateProductRequest request, String fallbackSkuCode, String fallbackSaleStatus) {
        String productName = normalizeProductName(request.productName());
        String unit = normalizeUnit(request.unit());
        String quoteType = normalizeQuoteType(request.quoteType());
        SaleModePayload saleModePayload = normalizeSaleModePayload(request.saleMode(), request.saleUnit(), request.saleUnitRatio(), unit);
        List<Map<String, Object>> skuRows = normalizeSkuRows(request, fallbackSkuCode);
        Map<String, Object> firstSku = skuRows.stream()
            .filter(row -> "ENABLED".equals(string(row.get("skuStatus"), "ENABLED")))
            .findFirst()
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "至少需要保留一个启用 SKU"));

        List<Map<String, Object>> tiers = normalizeTierRows(request.tierPrices());
        if ("TIER_PRICE".equals(quoteType) && tiers.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "阶梯报价至少需要配置一条阶梯价格");
        }

        return new ProductPayload(
            productName,
            normalizeSkuText(string(firstSku.get("skuCode"), fallbackSkuCode), "SKU编码"),
            normalizeSkuText(clean(firstSku.get("skuBarcode"), request.skuBarcode()), "SKU条码"),
            deriveSkuName(firstSku),
            string(firstSku.get("skuStatus"), "ENABLED"),
            unit,
            clean(request.categoryName(), "后台商品"),
            clean(request.brandName(), "B2B"),
            normalizeAttributeTemplateId(request.attributeTemplateId()),
            normalizeCustomAttributes(request.attributeTemplateId(), request.customAttributes()),
            quoteType,
            saleModePayload.saleMode(),
            saleModePayload.saleUnit(),
            saleModePayload.saleUnitRatio(),
            clean(request.mainImageUrl(), ""),
            clean(request.detailContent(), "该商品来自后台商品档案，价格、库存和上下架状态会实时同步。"),
            validatePrice(decimal(firstSku.get("salePrice"), request.salePrice()), "单价"),
            validateStock(integer(firstSku.get("stockQuantity"), request.stockQuantity())),
            validateMinOrderQuantity(integer(firstSku.get("minOrderQuantity"), request.minOrderQuantity()), "最小起订量"),
            json(skuRows),
            json(tiers),
            normalizeSaleStatus(request.saleStatus(), fallbackSaleStatus)
        );
    }

    private Long normalizeAttributeTemplateId(Long templateId) {
        if (templateId == null) return null;
        Integer count = jdbcClient.sql("SELECT COUNT(*) FROM product_attribute_templates WHERE id = :id")
            .param("id", templateId)
            .query(Integer.class)
            .single();
        if (count == null || count == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "所选商品属性模板不存在");
        }
        return templateId;
    }

    private String normalizeCustomAttributes(Long templateId, List<Map<String, Object>> requestedAttributes) {
        if (templateId == null) return "[]";
        String fieldsJson = jdbcClient.sql("SELECT fields_json FROM product_attribute_templates WHERE id = :id")
            .param("id", templateId)
            .query(String.class)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "所选商品属性模板不存在"));
        List<Map<String, Object>> templateFields = parseObjectRows(fieldsJson);
        Map<String, Map<String, Object>> allowedFields = new LinkedHashMap<>();
        for (Map<String, Object> field : templateFields) {
            String fieldId = clean(field.get("id"), "");
            String name = clean(field.get("name"), "");
            if (!fieldId.isBlank() && !name.isBlank()) allowedFields.put(fieldId, field);
        }
        List<Map<String, Object>> source = requestedAttributes == null ? List.of() : requestedAttributes;
        if (source.size() > 10) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "商品自定义属性最多保留10个字段");
        }
        List<Map<String, Object>> normalized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (Map<String, Object> attribute : source) {
            String fieldId = clean(attribute.get("fieldId"), clean(attribute.get("id"), ""));
            Map<String, Object> templateField = allowedFields.get(fieldId);
            if (templateField == null || !seen.add(fieldId)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("fieldId", fieldId);
            row.put("name", clean(templateField.get("name"), ""));
            row.put("value", clean(attribute.get("value"), ""));
            normalized.add(row);
        }
        return json(normalized);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseObjectRows(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            Object parsed = objectMapper.readValue(raw, Object.class);
            if (!(parsed instanceof List<?> values)) return List.of();
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Object value : values) {
                if (value instanceof Map<?, ?> map) {
                    rows.add((Map<String, Object>) map);
                }
            }
            return rows;
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private List<Map<String, Object>> normalizeSkuRows(CreateProductRequest request, String fallbackSkuCode) {
        List<Map<String, Object>> source = request.skuList() == null ? List.of() : request.skuList();
        if (source.isEmpty()) {
            source = List.of(Map.of(
                "skuCode", clean(request.skuCode(), fallbackSkuCode),
                "skuBarcode", clean(request.skuBarcode(), ""),
                "salePrice", request.salePrice(),
                "stockQuantity", request.stockQuantity(),
                "minOrderQuantity", request.minOrderQuantity(),
                "skuStatus", clean(request.skuStatus(), "ENABLED")
            ));
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < source.size(); i++) {
            Map<String, Object> row = source.get(i);
            String defaultSkuCode = i == 0 ? fallbackSkuCode : fallbackSkuCode + (i + 1);
            List<Map<String, Object>> specValues = normalizeSpecValues(row.get("specValues"));
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("skuCode", normalizeSkuText(clean(row.get("skuCode"), defaultSkuCode), "SKU编码"));
            normalized.put("skuBarcode", normalizeSkuText(clean(row.get("skuBarcode"), ""), "SKU条码"));
            normalized.put("skuName", deriveSkuName(specValues, row.get("skuName")));
            normalized.put("salePrice", validatePrice(decimal(row.get("salePrice"), request.salePrice()), "SKU单价"));
            normalized.put("stockQuantity", validateStock(integer(row.get("stockQuantity"), request.stockQuantity())));
            normalized.put("minOrderQuantity", validateMinOrderQuantity(integer(row.get("minOrderQuantity"), request.minOrderQuantity()), "最小起订量"));
            normalized.put("skuStatus", normalizeSkuStatus(row.get("skuStatus")));
            normalized.put("skuImageUrl", clean(row.get("skuImageUrl"), ""));
            normalized.put("specImageGroupId", clean(row.get("specImageGroupId"), ""));
            normalized.put("specKey", clean(row.get("specKey"), ""));
            normalized.put("specValues", specValues);

            List<Map<String, Object>> skuTiers = normalizeNestedTierRows(row.get("tierPrices"));
            if (!skuTiers.isEmpty()) {
                normalized.put("tierPrices", skuTiers);
            }
            rows.add(normalized);
        }

        validateSpecGroupLimits(rows);
        return rows;
    }

    private String deriveSkuName(Map<String, Object> row) {
        return deriveSkuName(row.get("specValues"), row.get("skuName"));
    }

    private String deriveSkuName(Object specValues, Object fallback) {
        List<String> values = new ArrayList<>();
        if (specValues instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> cell)) continue;
                String value = clean(cell.get("value"), "");
                if (!value.isBlank()) {
                    values.add(value);
                }
            }
        }
        if (!values.isEmpty()) {
            return String.join(" / ", values);
        }
        return clean(fallback, "");
    }
    private List<Map<String, Object>> normalizeSpecValues(Object source) {
        if (!(source instanceof List<?> list)) return List.of();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> row)) continue;
            String value = clean(row.get("value"), "");
            if (value.isBlank()) continue;
            if (value.length() > MAX_SPEC_VALUE_LENGTH) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "规格值不能超过10个字符");
            }
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("groupId", clean(row.get("groupId"), ""));
            normalized.put("groupName", clean(row.get("groupName"), ""));
            normalized.put("valueId", clean(row.get("valueId"), ""));
            normalized.put("value", value);
            normalized.put("image", clean(row.get("image"), ""));
            rows.add(normalized);
        }
        return rows;
    }

    private void validateSpecGroupLimits(List<Map<String, Object>> skuRows) {
        Map<String, Set<String>> groupValues = new LinkedHashMap<>();
        for (Map<String, Object> skuRow : skuRows) {
            Object source = skuRow.get("specValues");
            if (!(source instanceof List<?> specValues)) continue;
            for (Object item : specValues) {
                if (!(item instanceof Map<?, ?> specValue)) continue;
                String groupKey = clean(specValue.get("groupId"), "") + "|" + clean(specValue.get("groupName"), "");
                String valueKey = clean(specValue.get("valueId"), "") + "|" + clean(specValue.get("value"), "");
                if (groupKey.isBlank() || valueKey.isBlank()) continue;
                Set<String> currentValues = groupValues.computeIfAbsent(groupKey, key -> new LinkedHashSet<>());
                currentValues.add(valueKey);
                if (currentValues.size() > MAX_SPEC_VALUES_PER_GROUP) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "每种规格类型最多只能保留5个规格值");
                }
            }
        }
    }

    private List<Map<String, Object>> normalizeNestedTierRows(Object source) {
        if (!(source instanceof List<?> list)) return List.of();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> row)) continue;
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("minQty", row.get("minQty"));
            normalized.put("maxQty", row.get("maxQty"));
            normalized.put("price", row.get("price"));
            rows.add(normalized);
        }
        return normalizeTierRows(rows);
    }

    private List<Map<String, Object>> normalizeTierRows(List<Map<String, Object>> source) {
        if (source == null || source.isEmpty()) return List.of();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> row : source) {
            Integer minQty = validateMinOrderQuantity(integer(row.get("minQty"), null), "起订数量");
            Integer maxQty = integer(row.get("maxQty"), null);
            BigDecimal price = validatePrice(decimal(row.get("price"), null), "单价");
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("minQty", minQty);
            normalized.put("maxQty", maxQty == null || maxQty < minQty ? null : maxQty);
            normalized.put("price", price);
            rows.add(normalized);
        }
        return rows;
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "商品配置无法保存");
        }
    }

    private String normalizeQuoteType(String value) {
        String text = clean(value, "INDEPENDENT_PRICE");
        if ("TIER_PRICE".equalsIgnoreCase(text) || text.contains("阶梯")) return "TIER_PRICE";
        return "INDEPENDENT_PRICE";
    }

    private SaleModePayload normalizeSaleModePayload(String saleMode, String saleUnit, Integer saleUnitRatio, String baseUnit) {
        String normalizedSaleMode = normalizeSaleMode(saleMode);
        if ("NORMAL".equals(normalizedSaleMode)) {
            return new SaleModePayload("NORMAL", null, null);
        }

        String normalizedSaleUnit = clean(saleUnit, "");
        if (normalizedSaleUnit.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请选择销售单位");
        }
        if (normalizedSaleUnit.length() > MAX_SALE_UNIT_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "销售单位不能超过10个字符");
        }
        if (normalizedSaleUnit.equals(baseUnit)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "销售单位不能与商品单位相同");
        }
        if (saleUnitRatio == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请输入换算关系");
        }
        if (saleUnitRatio <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "换算倍数需为大于 0 的正整数");
        }
        return new SaleModePayload("BATCH", normalizedSaleUnit, saleUnitRatio);
    }

    private String normalizeSaleMode(String value) {
        String text = clean(value, "NORMAL").toUpperCase();
        if ("BATCH".equals(text) || text.contains("批量")) return "BATCH";
        return "NORMAL";
    }

    private String normalizeSaleStatus(String value, String fallback) {
        String text = clean(value, fallback == null ? "ON_SALE" : fallback);
        return "OFF_SALE".equalsIgnoreCase(text) ? "OFF_SALE" : "ON_SALE";
    }

    private String normalizeSkuStatus(Object value) {
        String text = string(value, "ENABLED");
        return "DISABLED".equalsIgnoreCase(text) ? "DISABLED" : "ENABLED";
    }

    private String normalizeProductName(String value) {
        String text = clean(value, "");
        if (text.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "商品名称不能为空");
        }
        if (text.length() > MAX_PRODUCT_NAME_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "商品名称不能超过30个字符");
        }
        return text;
    }

    private String normalizeUnit(String value) {
        String text = clean(value, "");
        if (text.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "单位不能为空");
        }
        if (text.length() > MAX_UNIT_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "单位不能超过10个字符");
        }
        return text;
    }

    private String normalizeSkuText(String value, String label) {
        String text = clean(value, "").replaceAll("[^0-9A-Za-z]", "");
        if (text.isEmpty()) return "";
        if (text.length() > MAX_SKU_TEXT_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, label + "不能超过18位");
        }
        return text;
    }

    private BigDecimal validatePrice(BigDecimal value, String label) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, label + "必须大于0");
        }
        if (value.compareTo(MAX_PRICE) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, label + "不能超过99999.99");
        }
        return value;
    }

    private Integer validateStock(Integer value) {
        if (value == null || value < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "库存必须为正整数");
        }
        if (value > MAX_STOCK) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "库存不能超过999999");
        }
        return value;
    }

    private Integer validateMinOrderQuantity(Integer value, String label) {
        if (value == null || value < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, label + "必须大于0");
        }
        if (value > MAX_MIN_ORDER_QUANTITY) {
            throw new ApiException(HttpStatus.BAD_REQUEST, label + "不能超过100");
        }
        return value;
    }

    private String clean(Object value, String fallback) {
        String text = value == null ? "" : String.valueOf(value).trim();
        return text.isEmpty() ? fallback : text;
    }

    private String string(Object value, String fallback) {
        return clean(value, fallback);
    }

    private Integer integer(Object value, Integer fallback) {
        if (value == null || String.valueOf(value).isBlank()) return fallback;
        if (value instanceof Number number) return number.intValue();
        return new BigDecimal(String.valueOf(value).trim()).intValue();
    }

    private BigDecimal decimal(Object value, BigDecimal fallback) {
        if (value == null || String.valueOf(value).isBlank()) return fallback;
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        return new BigDecimal(String.valueOf(value).trim());
    }

    private record ProductPayload(
        String productName,
        String skuCode,
        String skuBarcode,
        String skuName,
        String skuStatus,
        String unit,
        String categoryName,
        String brandName,
        Long attributeTemplateId,
        String customAttributesJson,
        String quoteType,
        String saleMode,
        String saleUnit,
        Integer saleUnitRatio,
        String mainImageUrl,
        String detailContent,
        BigDecimal salePrice,
        Integer stockQuantity,
        Integer minOrderQuantity,
        String skuListJson,
        String tierPricesJson,
        String saleStatus
    ) {
    }

    private record SaleModePayload(
        String saleMode,
        String saleUnit,
        Integer saleUnitRatio
    ) {
    }
}

