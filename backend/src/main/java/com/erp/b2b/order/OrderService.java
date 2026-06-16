package com.erp.b2b.order;

import com.erp.b2b.common.ApiException;
import com.erp.b2b.customer.Customer;
import com.erp.b2b.customer.CustomerRepository;
import com.erp.b2b.product.Product;
import com.erp.b2b.product.ProductRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    public OrderService(CustomerRepository customerRepository, ProductRepository productRepository, OrderRepository orderRepository) {
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
    }

    public List<SalesOrder> listOrders() {
        return orderRepository.findAll();
    }

    public SalesOrder getOrder(Long id) {
        return orderRepository.findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    @Transactional
    public SalesOrder createOrder(CreateOrderRequest request) {
        Customer customer = customerRepository.findById(request.customerId())
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Customer not found"));
        if (!"APPROVED".equals(customer.auditStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Customer is not approved");
        }

        String orderNo = "SO" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        List<Product> products = request.items().stream()
            .map(item -> productRepository.findById(item.productId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Product not found: " + item.productId())))
            .toList();

        BigDecimal totalAmount = BigDecimal.ZERO;
        for (int i = 0; i < request.items().size(); i++) {
            CreateOrderItemRequest item = request.items().get(i);
            Product product = products.get(i);
            validateProductForOrder(item, product);
            totalAmount = totalAmount.add(product.salePrice().multiply(BigDecimal.valueOf(item.quantity())));
        }

        String normalizedPaymentMethod = normalizePaymentMethod(request.paymentMethod());
        String orderStatus = "SHIP_AFTER_PAY".equals(normalizedPaymentMethod) ? "WAIT_SHIP" : "WAIT_PAY";
        String paymentStatus = "SHIP_AFTER_PAY".equals(normalizedPaymentMethod) ? "NOT_REQUIRED_BEFORE_RECEIPT" : "UNPAID";

        SalesOrder draftOrder = new SalesOrder(
            null,
            orderNo,
            customer.id(),
            customer.companyName(),
            orderStatus,
            paymentStatus,
            "UNSHIPPED",
            normalizedPaymentMethod,
            totalAmount,
            request.receiverName(),
            request.receiverPhone(),
            request.receiverAddress(),
            request.remark(),
            null,
            null,
            List.of()
        );
        Long orderId = orderRepository.insertOrder(draftOrder);

        for (int i = 0; i < request.items().size(); i++) {
            CreateOrderItemRequest item = request.items().get(i);
            Product product = products.get(i);
            int updated = productRepository.deductStock(product.id(), item.quantity());
            if (updated != 1) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + product.productName());
            }
            Product latestProduct = productRepository.findById(product.id()).orElseThrow();
            BigDecimal lineAmount = product.salePrice().multiply(BigDecimal.valueOf(item.quantity()));
            orderRepository.insertItem(new SalesOrderItem(
                null,
                orderId,
                product.id(),
                product.productName(),
                product.skuCode(),
                product.skuName(),
                "BATCH".equals(product.saleMode()) && product.saleUnit() != null && !product.saleUnit().isBlank() ? product.saleUnit() : product.unit(),
                item.quantity(),
                0,
                product.salePrice(),
                lineAmount
            ));
            orderRepository.insertInventoryMovement(product.id(), "ORDER_DEDUCT", -item.quantity(), latestProduct.stockQuantity(), orderNo, "Order submitted");
        }

        return getOrder(orderId);
    }

    @Transactional
    public SalesOrder markPaid(Long id) {
        SalesOrder order = getOrder(id);
        if (!List.of("WAIT_PAY", "WAIT_CONFIRM").contains(order.orderStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only unpaid orders can be marked paid");
        }
        orderRepository.updateStatus(id, "WAIT_SHIP", "PAID", "UNSHIPPED");
        return getOrder(id);
    }

    @Transactional
    public SalesOrder ship(Long id, ShipOrderRequest request) {
        SalesOrder order = getOrder(id);
        if (!"WAIT_SHIP".equals(order.orderStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only wait-ship orders can be shipped");
        }
        orderRepository.markItemsShipped(id);
        orderRepository.updateStatus(id, "WAIT_RECEIVE", order.paymentStatus(), "SHIPPED");
        return getOrder(id);
    }

    @Transactional
    public SalesOrder complete(Long id) {
        SalesOrder order = getOrder(id);
        if (!"WAIT_RECEIVE".equals(order.orderStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only wait-receive orders can be completed");
        }
        String nextOrderStatus = "SHIP_AFTER_PAY".equals(order.paymentMethod()) ? "WAIT_PAY" : "COMPLETED";
        String nextPaymentStatus = "SHIP_AFTER_PAY".equals(order.paymentMethod()) ? "UNPAID" : order.paymentStatus();
        orderRepository.updateStatus(id, nextOrderStatus, nextPaymentStatus, "RECEIVED");
        return getOrder(id);
    }

    private void validateProductForOrder(CreateOrderItemRequest item, Product product) {
        if (!"ON_SALE".equals(product.saleStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Product is not on sale: " + product.productName());
        }
        if (item.quantity() < product.minOrderQuantity()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity is lower than minimum order quantity for " + product.productName());
        }
        if ("BATCH".equals(product.saleMode()) && (item.quantity() == null || item.quantity() <= 0)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be a positive integer for " + product.productName());
        }
        if (item.quantity() > product.stockQuantity()) {
            throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + product.productName());
        }
    }

    private String normalizePaymentMethod(String value) {
        return switch (String.valueOf(value).trim().toUpperCase()) {
            case "OFFLINE", "OFFLINE_PAY" -> "OFFLINE_PAY";
            case "SHIP_AFTER_PAY", "COD_LATER" -> "SHIP_AFTER_PAY";
            default -> "ONLINE_PAY";
        };
    }
}
