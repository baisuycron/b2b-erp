package com.erp.b2b.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record Product(
    Long id,
    String productCode,
    String skuCode,
    String skuBarcode,
    String pinyinCode,
    String pinyinFull,
    String initialCode,
    String productName,
    String categoryName,
    String brandName,
    String skuName,
    String skuStatus,
    String unit,
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
    String saleStatus,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
