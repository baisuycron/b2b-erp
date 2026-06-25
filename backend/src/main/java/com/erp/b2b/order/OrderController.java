package com.erp.b2b.order;

import com.erp.b2b.auth.AuthTokenService;
import com.erp.b2b.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orderService;
    private final AuthTokenService authTokenService;
    private final JdbcClient jdbcClient;

    public OrderController(OrderService orderService, AuthTokenService authTokenService, JdbcClient jdbcClient) {
        this.orderService = orderService;
        this.authTokenService = authTokenService;
        this.jdbcClient = jdbcClient;
    }

    @GetMapping
    public List<SalesOrder> list(HttpServletRequest request) {
        return orderService.listOrdersForCustomer(requireBuyerCustomerId(request));
    }

    @GetMapping("/{id}")
    public SalesOrder detail(HttpServletRequest request, @PathVariable Long id) {
        return orderService.getOrderForCustomer(id, requireBuyerCustomerId(request));
    }

    @PostMapping
    public SalesOrder create(HttpServletRequest servletRequest, @Valid @RequestBody CreateOrderRequest request) {
        Long customerId = requireBuyerCustomerId(servletRequest);
        return orderService.createOrder(new CreateOrderRequest(
            customerId,
            request.paymentMethod(),
            request.receiverName(),
            request.receiverPhone(),
            request.receiverAddress(),
            request.remark(),
            request.items()
        ));
    }

    @PostMapping("/{id}/pay")
    public SalesOrder markPaid(HttpServletRequest request, @PathVariable Long id) {
        orderService.getOrderForCustomer(id, requireBuyerCustomerId(request));
        return orderService.markPaid(id);
    }

    @PostMapping("/{id}/ship")
    public SalesOrder ship(HttpServletRequest servletRequest, @PathVariable Long id, @Valid @RequestBody ShipOrderRequest request) {
        orderService.getOrderForCustomer(id, requireBuyerCustomerId(servletRequest));
        return orderService.ship(id, request);
    }

    @PostMapping("/{id}/complete")
    public SalesOrder complete(HttpServletRequest request, @PathVariable Long id) {
        orderService.getOrderForCustomer(id, requireBuyerCustomerId(request));
        return orderService.complete(id);
    }

    private Long requireBuyerCustomerId(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.startsWith("Bearer ")
            ? authorization.substring(7).trim()
            : "";
        String subject = authTokenService.subject(token, "BUYER");
        if (subject.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "\u8bf7\u5148\u767b\u5f55");
        }
        try {
            Long customerId = Long.parseLong(subject);
            String status = jdbcClient.sql("SELECT audit_status FROM customers WHERE id = :id")
                .param("id", customerId)
                .query(String.class)
                .optional()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "\u8bf7\u5148\u767b\u5f55"));
            if ("DISABLED".equals(status)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "\u5f53\u524d\u8d26\u53f7\u5df2\u505c\u7528\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458");
            }
            return customerId;
        } catch (NumberFormatException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "\u8bf7\u5148\u767b\u5f55");
        }
    }
}
