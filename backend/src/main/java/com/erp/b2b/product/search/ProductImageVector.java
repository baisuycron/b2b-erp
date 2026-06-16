package com.erp.b2b.product.search;

public record ProductImageVector(
    Long id,
    Long productId,
    String skuId,
    String imageUrl,
    String imageType,
    String vectorId,
    String vectorStatus
) {
}
