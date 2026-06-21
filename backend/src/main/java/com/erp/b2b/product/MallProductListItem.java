package com.erp.b2b.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MallProductListItem(
    Long id,
    String productCode,
    String skuBarcode,
    String productName,
    String categoryName,
    String brandName,
    String skuName,
    String unit,
    String quoteType,
    String saleMode,
    String saleUnit,
    Integer saleUnitRatio,
    BigDecimal salePrice,
    Integer stockQuantity,
    Integer minOrderQuantity,
    String saleStatus,
    String mainImageCardUrl,
    String mainImageThumbnailUrl,
    LocalDateTime updatedAt
) {
}
