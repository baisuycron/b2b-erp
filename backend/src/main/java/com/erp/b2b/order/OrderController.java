package com.erp.b2b.order;

import jakarta.validation.Valid;
import java.util.List;
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

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public List<SalesOrder> list() {
        return orderService.listOrders();
    }

    @GetMapping("/{id}")
    public SalesOrder detail(@PathVariable Long id) {
        return orderService.getOrder(id);
    }

    @PostMapping
    public SalesOrder create(@Valid @RequestBody CreateOrderRequest request) {
        return orderService.createOrder(request);
    }

    @PostMapping("/{id}/pay")
    public SalesOrder markPaid(@PathVariable Long id) {
        return orderService.markPaid(id);
    }

    @PostMapping("/{id}/ship")
    public SalesOrder ship(@PathVariable Long id, @Valid @RequestBody ShipOrderRequest request) {
        return orderService.ship(id, request);
    }

    @PostMapping("/{id}/complete")
    public SalesOrder complete(@PathVariable Long id) {
        return orderService.complete(id);
    }
}
