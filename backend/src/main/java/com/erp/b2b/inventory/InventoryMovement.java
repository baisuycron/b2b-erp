package com.erp.b2b.inventory;

import java.time.LocalDateTime;

public record InventoryMovement(
    Long id,
    Long productId,
    String productName,
    String skuCode,
    String movementType,
    Integer quantityDelta,
    Integer stockAfter,
    String sourceType,
    String sourceNo,
    String remark,
    LocalDateTime createdAt
) {
}
