package com.erp.b2b.order;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class OrderRepository {
    private final JdbcClient jdbcClient;

    public OrderRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Long insertOrder(SalesOrder order) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("""
            INSERT INTO sales_orders (
              order_no, customer_id, customer_name, order_status, payment_status, fulfillment_status,
              payment_method, total_amount, receiver_name, receiver_phone, receiver_address, remark
            )
            VALUES (
              :orderNo, :customerId, :customerName, :orderStatus, :paymentStatus, :fulfillmentStatus,
              :paymentMethod, :totalAmount, :receiverName, :receiverPhone, :receiverAddress, :remark
            )
            """)
            .param("orderNo", order.orderNo())
            .param("customerId", order.customerId())
            .param("customerName", order.customerName())
            .param("orderStatus", order.orderStatus())
            .param("paymentStatus", order.paymentStatus())
            .param("fulfillmentStatus", order.fulfillmentStatus())
            .param("paymentMethod", order.paymentMethod())
            .param("totalAmount", order.totalAmount())
            .param("receiverName", order.receiverName())
            .param("receiverPhone", order.receiverPhone())
            .param("receiverAddress", order.receiverAddress())
            .param("remark", order.remark())
            .update(keyHolder, "id");
        return keyHolder.getKey().longValue();
    }

    public void insertItem(SalesOrderItem item) {
        jdbcClient.sql("""
            INSERT INTO sales_order_items (
              order_id, product_id, product_name, sku_code, sku_name, unit, quantity, shipped_quantity, unit_price, line_amount
            )
            VALUES (
              :orderId, :productId, :productName, :skuCode, :skuName, :unit, :quantity, :shippedQuantity, :unitPrice, :lineAmount
            )
            """)
            .param("orderId", item.orderId())
            .param("productId", item.productId())
            .param("productName", item.productName())
            .param("skuCode", item.skuCode())
            .param("skuName", item.skuName())
            .param("unit", item.unit())
            .param("quantity", item.quantity())
            .param("shippedQuantity", item.shippedQuantity())
            .param("unitPrice", item.unitPrice())
            .param("lineAmount", item.lineAmount())
            .update();
    }

    public void insertInventoryMovement(Long productId, String movementType, int quantityDelta, int stockAfter, String sourceNo, String remark) {
        jdbcClient.sql("""
            INSERT INTO inventory_movements (product_id, movement_type, quantity_delta, stock_after, source_type, source_no, remark)
            VALUES (:productId, :movementType, :quantityDelta, :stockAfter, 'ORDER', :sourceNo, :remark)
            """)
            .param("productId", productId)
            .param("movementType", movementType)
            .param("quantityDelta", quantityDelta)
            .param("stockAfter", stockAfter)
            .param("sourceNo", sourceNo)
            .param("remark", remark)
            .update();
    }

    public List<SalesOrder> findAll() {
        return jdbcClient.sql("""
            SELECT id, order_no, customer_id, customer_name, order_status, payment_status, fulfillment_status,
                   payment_method, total_amount, receiver_name, receiver_phone, receiver_address, remark, created_at, updated_at
            FROM sales_orders
            ORDER BY id DESC
            """)
            .query(this::mapOrderWithoutItems)
            .list()
            .stream()
            .map(order -> orderWithItems(order, findItems(order.id())))
            .toList();
    }

    public Optional<SalesOrder> findById(Long id) {
        return jdbcClient.sql("""
            SELECT id, order_no, customer_id, customer_name, order_status, payment_status, fulfillment_status,
                   payment_method, total_amount, receiver_name, receiver_phone, receiver_address, remark, created_at, updated_at
            FROM sales_orders
            WHERE id = :id
            """)
            .param("id", id)
            .query(this::mapOrderWithoutItems)
            .optional()
            .map(order -> orderWithItems(order, findItems(order.id())));
    }

    public int updateStatus(Long id, String orderStatus, String paymentStatus, String fulfillmentStatus) {
        return jdbcClient.sql("""
            UPDATE sales_orders
            SET order_status = :orderStatus,
                payment_status = :paymentStatus,
                fulfillment_status = :fulfillmentStatus
            WHERE id = :id
            """)
            .param("id", id)
            .param("orderStatus", orderStatus)
            .param("paymentStatus", paymentStatus)
            .param("fulfillmentStatus", fulfillmentStatus)
            .update();
    }

    public int markPaid(Long id, String paymentNo) {
        return jdbcClient.sql("""
            UPDATE sales_orders
            SET order_status = 'WAIT_SHIP',
                payment_status = 'PAID',
                fulfillment_status = 'UNSHIPPED',
                payment_time = COALESCE(payment_time, CURRENT_TIMESTAMP(6)),
                payment_no = COALESCE(NULLIF(payment_no, ''), :paymentNo)
            WHERE id = :id
            """)
            .param("id", id)
            .param("paymentNo", paymentNo)
            .update();
    }

    public int completeOrder(Long id, String orderStatus, String paymentStatus) {
        return jdbcClient.sql("""
            UPDATE sales_orders
            SET order_status = :orderStatus,
                payment_status = :paymentStatus,
                fulfillment_status = 'RECEIVED',
                receive_time = COALESCE(receive_time, CURRENT_TIMESTAMP(6)),
                completed_time = CASE
                  WHEN :orderStatus = 'COMPLETED' THEN COALESCE(completed_time, CURRENT_TIMESTAMP(6))
                  ELSE completed_time
                END
            WHERE id = :id
            """)
            .param("id", id)
            .param("orderStatus", orderStatus)
            .param("paymentStatus", paymentStatus)
            .update();
    }

    public List<SalesOrder> findExpiredUnpaidOrders(LocalDateTime expireBefore) {
        return jdbcClient.sql("""
            SELECT id, order_no, customer_id, customer_name, order_status, payment_status, fulfillment_status,
                   payment_method, total_amount, receiver_name, receiver_phone, receiver_address, remark, created_at, updated_at
            FROM sales_orders
            WHERE order_status = 'WAIT_PAY'
              AND payment_status = 'UNPAID'
              AND fulfillment_status = 'UNSHIPPED'
              AND created_at <= :expireBefore
            ORDER BY id
            """)
            .param("expireBefore", expireBefore)
            .query(this::mapOrderWithoutItems)
            .list()
            .stream()
            .map(order -> orderWithItems(order, findItems(order.id())))
            .toList();
    }

    public int markItemsShipped(Long orderId) {
        return jdbcClient.sql("""
            UPDATE sales_order_items
            SET shipped_quantity = quantity
            WHERE order_id = :orderId
            """)
            .param("orderId", orderId)
            .update();
    }

    private List<SalesOrderItem> findItems(Long orderId) {
        return jdbcClient.sql("""
            SELECT id, order_id, product_id, product_name, sku_code, sku_name, unit, quantity, shipped_quantity, unit_price, line_amount
            FROM sales_order_items
            WHERE order_id = :orderId
            ORDER BY id
            """)
            .param("orderId", orderId)
            .query(this::mapItem)
            .list();
    }

    private SalesOrder mapOrderWithoutItems(ResultSet rs, int rowNum) throws SQLException {
        return new SalesOrder(
            rs.getLong("id"),
            rs.getString("order_no"),
            rs.getLong("customer_id"),
            rs.getString("customer_name"),
            rs.getString("order_status"),
            rs.getString("payment_status"),
            rs.getString("fulfillment_status"),
            rs.getString("payment_method"),
            rs.getBigDecimal("total_amount"),
            rs.getString("receiver_name"),
            rs.getString("receiver_phone"),
            rs.getString("receiver_address"),
            rs.getString("remark"),
            rs.getTimestamp("created_at").toLocalDateTime(),
            rs.getTimestamp("updated_at").toLocalDateTime(),
            List.of()
        );
    }

    private SalesOrderItem mapItem(ResultSet rs, int rowNum) throws SQLException {
        return new SalesOrderItem(
            rs.getLong("id"),
            rs.getLong("order_id"),
            rs.getLong("product_id"),
            rs.getString("product_name"),
            rs.getString("sku_code"),
            rs.getString("sku_name"),
            rs.getString("unit"),
            rs.getInt("quantity"),
            rs.getInt("shipped_quantity"),
            rs.getBigDecimal("unit_price"),
            rs.getBigDecimal("line_amount")
        );
    }

    private SalesOrder orderWithItems(SalesOrder order, List<SalesOrderItem> items) {
        return new SalesOrder(
            order.id(),
            order.orderNo(),
            order.customerId(),
            order.customerName(),
            order.orderStatus(),
            order.paymentStatus(),
            order.fulfillmentStatus(),
            order.paymentMethod(),
            order.totalAmount(),
            order.receiverName(),
            order.receiverPhone(),
            order.receiverAddress(),
            order.remark(),
            order.createdAt(),
            order.updatedAt(),
            items
        );
    }
}
