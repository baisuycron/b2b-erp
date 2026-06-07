package com.erp.b2b.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateProductRequest(
    @NotBlank String productName,
    @NotBlank String skuName,
    @NotBlank String unit,
    @NotNull @DecimalMin("0.01") BigDecimal salePrice,
    @NotNull @Min(0) Integer stockQuantity,
    @NotNull @Min(1) Integer minOrderQuantity
) {
}
