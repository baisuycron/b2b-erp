package com.erp.b2b.order;

import jakarta.validation.constraints.NotBlank;

public record ShipOrderRequest(
    @NotBlank String logisticsCompany,
    @NotBlank String logisticsNo
) {
}
