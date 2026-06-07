package com.erp.b2b.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateOrderRequest(
    @NotNull Long customerId,
    @NotBlank String paymentMethod,
    @NotBlank String receiverName,
    @NotBlank String receiverPhone,
    @NotBlank String receiverAddress,
    String remark,
    @NotEmpty List<@Valid CreateOrderItemRequest> items
) {
}
