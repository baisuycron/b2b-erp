package com.erp.b2b.order;

import jakarta.validation.constraints.NotBlank;

public record ShipOrderRequest(
    @NotBlank String shipmentMethod,
    @NotBlank String logisticsCompany,
    @NotBlank String logisticsNo
) {
    public ShipOrderRequest(String logisticsCompany, String logisticsNo) {
        this("EXPRESS", logisticsCompany, logisticsNo);
    }
}
