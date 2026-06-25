package com.erp.b2b.customer;

import jakarta.validation.constraints.NotBlank;

public record CreateCustomerRequest(
    @NotBlank String companyName,
    @NotBlank String contactName,
    @NotBlank String contactPhone,
    String loginPhone,
    String password,
    Long groupId,
    String address,
    String salesmanName,
    String remark,
    String operatorName
) {
}
