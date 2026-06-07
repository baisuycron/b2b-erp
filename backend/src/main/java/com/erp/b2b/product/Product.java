package com.erp.b2b.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record Product(
    Long id,
    String productCode,
    String skuCode,
    String productName,
    String skuName,
    String unit,
    BigDecimal salePrice,
    Integer stockQuantity,
    Integer minOrderQuantity,
    String saleStatus,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
