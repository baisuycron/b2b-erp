package com.erp.b2b.product.search;

import java.math.BigDecimal;

public record ProductImageSearchResult(
    Long productId,
    String productName,
    String imageUrl,
    BigDecimal price,
    Integer stockQuantity,
    Integer minOrderQuantity,
    String skuCode,
    String categoryName,
    String brandName,
    Double similarity
) {
}
