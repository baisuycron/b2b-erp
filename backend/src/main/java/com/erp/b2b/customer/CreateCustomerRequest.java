package com.erp.b2b.customer;

import jakarta.validation.constraints.NotBlank;

public record CreateCustomerRequest(
    @NotBlank String companyName,
    @NotBlank String contactName,
    @NotBlank String contactPhone,
    String address,
    String salesmanName
) {
}
