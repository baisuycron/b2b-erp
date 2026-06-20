package com.erp.b2b.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductListItem(
    Long id,
    String productCode,
    String skuCode,
    String skuBarcode,
    String productName,
    String categoryName,
    String brandName,
    String skuName,
    String unit,
    String quoteType,
    BigDecimal salePrice,
    Integer stockQuantity,
    String saleStatus,
    String mainImageThumbnailUrl,
    LocalDateTime updatedAt
) {
}
