package com.erp.b2b.order;

import java.math.BigDecimal;

public record SalesOrderItem(
    Long id,
    Long orderId,
    Long productId,
    String productName,
    String skuCode,
    String skuName,
    String unit,
    Integer quantity,
    Integer shippedQuantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount
) {
}
