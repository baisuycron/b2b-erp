package com.erp.b2b.customer;

import java.time.LocalDateTime;

public record Customer(
    Long id,
    String customerCode,
    String companyName,
    String contactName,
    String contactPhone,
    String address,
    String auditStatus,
    String status,
    Long groupId,
    String groupCode,
    String groupName,
    String groupStatus,
    String salesmanName,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
