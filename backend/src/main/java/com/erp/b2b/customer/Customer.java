package com.erp.b2b.customer;

import java.time.LocalDateTime;

public record Customer(
    Long id,
    String customerCode,
    String companyName,
    String contactName,
    String contactPhone,
    String auditStatus,
    String salesmanName,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
