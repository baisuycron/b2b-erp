package com.erp.b2b.order;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SalesOrder(
    Long id,
    String orderNo,
    Long customerId,
    String customerName,
    String orderStatus,
    String paymentStatus,
    String fulfillmentStatus,
    String paymentMethod,
    BigDecimal totalAmount,
    String receiverName,
    String receiverPhone,
    String receiverAddress,
    String remark,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<SalesOrderItem> items
) {
}
