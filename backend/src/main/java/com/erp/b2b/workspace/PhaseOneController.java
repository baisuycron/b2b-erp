package com.erp.b2b.workspace;

import com.erp.b2b.common.ApiException;
import com.erp.b2b.inventory.InventoryRepository;
import com.erp.b2b.order.OrderService;
import com.erp.b2b.product.CreateProductRequest;
import com.erp.b2b.product.Product;
import com.erp.b2b.product.ProductRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PhaseOneController {
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderService orderService;
    private final Map<Long, Map<String, Object>> afterSales = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, Object>> invoices = new ConcurrentHashMap<>();

    public PhaseOneController(ProductRepository productRepository, InventoryRepository inventoryRepository, OrderService orderService) {
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderService = orderService;
        seedWorkflowData();
    }

    @GetMapping("/admin/summary")
    public Map<String, Object> adminSummary() {
        List<Product> products = productRepository.findAll();
        var orders = orderService.listOrders();
        return row(
            "todayOrders", orders.size(),
            "saleableSkus", products.stream().filter(product -> "ON_SALE".equals(product.saleStatus())).count(),
            "stockWarning", products.stream().filter(product -> product.stockQuantity() <= 50).count(),
            "pendingAfterSale", afterSales.values().stream().filter(item -> !"COMPLETED".equals(item.get("status"))).count(),
            "pendingInvoice", invoices.values().stream().filter(item -> "WAIT_INVOICE".equals(item.get("status"))).count(),
            "todoCards", List.of(
                row("module", "采购管理", "title", "待入库采购单", "count", 2, "target", "purchase"),
                row("module", "订单管理", "title", "待发货订单", "count", orders.stream().filter(order -> "WAIT_SHIP".equals(order.orderStatus())).count(), "target", "orders"),
                row("module", "售后管理", "title", "待审核售后", "count", 1, "target", "afterSales"),
                row("module", "开票管理", "title", "待开票申请", "count", adminInvoices().stream().filter(item -> "WAIT_INVOICE".equals(item.get("status"))).count(), "target", "invoices")
            )
        );
    }

    @PostMapping("/admin/login")
    public Map<String, Object> adminLogin(@RequestBody Map<String, Object> request) {
        return row("token", "demo-admin-token", "accountName", request.getOrDefault("username", "admin"), "role", "超级管理员");
    }

    @GetMapping("/admin/accounts")
    public List<Map<String, Object>> adminAccounts() {
        return List.of(
            row("id", 1, "accountName", "admin", "realName", "超级管理员", "phone", "13800000000", "role", "超级管理员", "status", "启用"),
            row("id", 2, "accountName", "warehouse01", "realName", "仓库张", "phone", "13700000001", "role", "仓库人员", "status", "启用"),
            row("id", 3, "accountName", "finance01", "realName", "财务李", "phone", "13900000002", "role", "财务人员", "status", "禁用")
        );
    }

    @GetMapping("/admin/roles")
    public List<Map<String, Object>> adminRoles() {
        return List.of(
            row("id", 1, "roleName", "超级管理员", "description", "拥有全部菜单和按钮权限", "accountCount", 1, "status", "启用"),
            row("id", 2, "roleName", "仓库人员", "description", "负责采购入库、库存调整和订单发货", "accountCount", 3, "status", "启用"),
            row("id", 3, "roleName", "财务人员", "description", "负责支付记录、退款记录和开票处理", "accountCount", 2, "status", "启用")
        );
    }

    @GetMapping("/admin/permissions/tree")
    public List<Map<String, Object>> permissionTree() {
        return List.of(
            row("module", "商品管理", "actions", List.of("查看", "新增", "编辑", "上架", "下架")),
            row("module", "采购管理", "actions", List.of("供应商维护", "采购单维护", "采购入库")),
            row("module", "订单管理", "actions", List.of("查看", "发货", "取消", "确认收货")),
            row("module", "售后管理", "actions", List.of("审核", "确认退货收货", "退款")),
            row("module", "开票管理", "actions", List.of("上传发票", "确认开票", "驳回"))
        );
    }

    @GetMapping("/admin/products")
    public List<Product> adminProducts() {
        return productRepository.findAll();
    }

    @PostMapping("/admin/products")
    public Product createAdminProduct(@RequestBody CreateProductRequest request) {
        long suffix = System.currentTimeMillis();
        return productRepository.create(request, "P-" + suffix, "SKU-" + suffix);
    }

    @PutMapping("/admin/products/{productId}/on-sale")
    public Product onSale(@PathVariable Long productId) {
        productRepository.setSaleStatus(productId, "ON_SALE");
        return productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    @PutMapping("/admin/products/{productId}/off-sale")
    public Product offSale(@PathVariable Long productId) {
        productRepository.setSaleStatus(productId, "OFF_SALE");
        return productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    @GetMapping({"/mall/home/products", "/mall/products"})
    public List<Product> mallProducts() {
        return productRepository.findAll().stream()
            .filter(product -> "ON_SALE".equals(product.saleStatus()))
            .toList();
    }

    @GetMapping("/mall/products/{productId}")
    public Product mallProductDetail(@PathVariable Long productId) {
        return productRepository.findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    @PostMapping("/buyer/register")
    public Map<String, Object> buyerRegister(@RequestBody Map<String, Object> request) {
        return row("buyerNo", "B" + System.currentTimeMillis() % 1000000, "phone", request.get("phone"), "status", "启用", "auditRequired", false);
    }

    @PostMapping("/buyer/login")
    public Map<String, Object> buyerLogin(@RequestBody Map<String, Object> request) {
        return row("token", "demo-buyer-token", "phone", request.getOrDefault("phone", "13800010001"), "buyerName", "杭州采购王");
    }

    @GetMapping("/buyer/profile")
    public Map<String, Object> buyerProfile() {
        return row("buyerNo", "B000001", "buyerName", "杭州采购王", "companyName", "杭州某某商贸有限公司", "phone", "13800010001", "accountStatus", "启用");
    }

    @GetMapping("/mall/cart")
    public Map<String, Object> mallCart() {
        return row("checkedAmount", 245, "items", productRepository.findAll().stream().limit(2).map(product -> row(
            "cartItemId", product.id(),
            "productId", product.id(),
            "productName", product.productName(),
            "skuName", product.skuName(),
            "quantity", product.minOrderQuantity(),
            "salePrice", product.salePrice(),
            "checked", true
        )).toList());
    }

    @GetMapping("/mall/cart/count")
    public Map<String, Object> mallCartCount() {
        return row("count", 2);
    }

    @GetMapping("/admin/suppliers")
    public List<Map<String, Object>> suppliers() {
        return List.of(
            row("id", 1, "supplierNo", "SUP202606070001", "supplierName", "杭州水饮供应链", "contactName", "周经理", "phone", "13600000001", "purchaseCount", 12, "status", "启用"),
            row("id", 2, "supplierNo", "SUP202606070002", "supplierName", "宁波食品供应链", "contactName", "赵经理", "phone", "13600000002", "purchaseCount", 5, "status", "启用"),
            row("id", 3, "supplierNo", "SUP202606070003", "supplierName", "苏州办公物资", "contactName", "钱经理", "phone", "13600000003", "purchaseCount", 0, "status", "停用")
        );
    }

    @GetMapping("/admin/purchase-orders")
    public List<Map<String, Object>> purchaseOrders() {
        List<Product> products = productRepository.findAll();
        Long firstProductId = products.isEmpty() ? 1L : products.get(0).id();
        return List.of(
            row("id", 1, "purchaseNo", "PO202606070001", "supplierName", "杭州水饮供应链", "skuCount", 3, "purchaseQty", 300, "stockedQty", 0, "amount", 8600, "expectedArrivalDate", "2026-06-10", "status", "WAIT_STOCK_IN", "targetProductId", firstProductId),
            row("id", 2, "purchaseNo", "PO202606070002", "supplierName", "宁波食品供应链", "skuCount", 2, "purchaseQty", 160, "stockedQty", 80, "amount", 4180, "expectedArrivalDate", "2026-06-11", "status", "PART_STOCK_IN", "targetProductId", firstProductId),
            row("id", 3, "purchaseNo", "PO202606060003", "supplierName", "苏州办公物资", "skuCount", 1, "purchaseQty", 60, "stockedQty", 60, "amount", 5340, "expectedArrivalDate", "2026-06-08", "status", "COMPLETED", "targetProductId", firstProductId)
        );
    }

    @PostMapping("/admin/purchase-orders/{purchaseOrderId}/stock-in")
    @Transactional
    public Map<String, Object> stockIn(@PathVariable Long purchaseOrderId, @RequestBody Map<String, Object> request) {
        Long productId = number(request.getOrDefault("productId", firstProductId())).longValue();
        int quantity = number(request.getOrDefault("quantity", 100)).intValue();
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        productRepository.addStock(productId, quantity);
        Product latest = productRepository.findById(productId).orElseThrow();
        String stockInNo = "IN" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        inventoryRepository.insertMovement(productId, "PURCHASE_STOCK_IN", quantity, latest.stockQuantity(), "PURCHASE_ORDER", stockInNo, "采购入库：" + product.productName());
        return row("stockInNo", stockInNo, "purchaseOrderId", purchaseOrderId, "productId", productId, "quantity", quantity, "stockAfter", latest.stockQuantity(), "status", "STOCKED");
    }

    @GetMapping("/admin/purchase-stock-ins")
    public List<Map<String, Object>> purchaseStockIns() {
        return inventoryRepository.findAll().stream()
            .filter(item -> "PURCHASE_STOCK_IN".equals(item.movementType()))
            .map(item -> row("stockInNo", item.sourceNo(), "productName", item.productName(), "skuCode", item.skuCode(), "quantity", item.quantityDelta(), "stockAfter", item.stockAfter(), "createdAt", item.createdAt()))
            .toList();
    }

    @GetMapping("/admin/inventory")
    public List<Map<String, Object>> inventoryOverview() {
        return productRepository.findAll().stream()
            .map(product -> row(
                "productId", product.id(),
                "productName", product.productName(),
                "skuCode", product.skuCode(),
                "actualStock", product.stockQuantity(),
                "occupiedStock", 0,
                "saleableStock", product.stockQuantity(),
                "soldQty", 0,
                "warningThreshold", 50,
                "inventoryStatus", product.stockQuantity() <= 50 ? "库存预警" : "正常"
            ))
            .toList();
    }

    @GetMapping("/admin/inventory/flows")
    public Object inventoryFlows() {
        return inventoryRepository.findAll();
    }

    @PostMapping("/admin/inventory/adjustments")
    @Transactional
    public Map<String, Object> inventoryAdjustment(@RequestBody Map<String, Object> request) {
        Long productId = number(request.getOrDefault("productId", firstProductId())).longValue();
        int quantity = number(request.getOrDefault("quantity", 10)).intValue();
        productRepository.addStock(productId, quantity);
        Product latest = productRepository.findById(productId).orElseThrow();
        String adjustmentNo = "ADJ" + System.currentTimeMillis() % 100000;
        inventoryRepository.insertMovement(productId, "MANUAL_ADJUST", quantity, latest.stockQuantity(), "INVENTORY_ADJUSTMENT", adjustmentNo, "库存调整");
        return row("adjustmentNo", adjustmentNo, "productId", productId, "quantity", quantity, "stockAfter", latest.stockQuantity());
    }

    @GetMapping("/admin/orders")
    public Object adminOrders() {
        return orderService.listOrders();
    }

    @GetMapping("/mall/orders")
    public Object mallOrders() {
        return orderService.listOrders();
    }

    @PostMapping("/mall/orders/{orderId}/confirm-receipt")
    public Object confirmReceipt(@PathVariable Long orderId) {
        return orderService.complete(orderId);
    }

    @GetMapping("/admin/finance/payments")
    public List<Map<String, Object>> payments() {
        return orderService.listOrders().stream().map(order -> row(
            "paymentNo", "PAY" + order.orderNo().replace("SO", ""),
            "orderNo", order.orderNo(),
            "buyerName", order.customerName(),
            "paymentMethod", order.paymentMethod(),
            "amount", order.totalAmount(),
            "paymentStatus", order.paymentStatus(),
            "paidAt", "PAID".equals(order.paymentStatus()) ? order.updatedAt() : null
        )).toList();
    }

    @GetMapping("/admin/finance/refunds")
    public List<Map<String, Object>> refunds() {
        return List.of(
            row("refundNo", "RF202606070001", "afterSaleNo", "AS202606070001", "orderNo", "SO202606040010", "buyerName", "上海宏达采购", "refundMethod", "原路退款", "amount", 72, "refundStatus", "退款成功", "refundedAt", "2026-06-07 11:30")
        );
    }

    @GetMapping("/admin/after-sales")
    public List<Map<String, Object>> afterSales() {
        return new ArrayList<>(afterSales.values());
    }

    @PostMapping({"/mall/after-sales", "/admin/after-sales"})
    public Map<String, Object> createAfterSale(@RequestBody Map<String, Object> request) {
        long id = System.currentTimeMillis() % 100000;
        Map<String, Object> item = row("id", id, "afterSaleNo", "AS" + id, "orderNo", request.getOrDefault("orderNo", "-"), "buyerName", request.getOrDefault("buyerName", "杭州采购王"), "type", request.getOrDefault("type", "ONLY_REFUND"), "refundAmount", request.getOrDefault("refundAmount", 72), "status", "WAIT_AUDIT", "createdAt", LocalDateTime.now());
        afterSales.put(id, item);
        return item;
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/audit")
    public Map<String, Object> auditAfterSale(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        Map<String, Object> item = afterSales.computeIfAbsent(afterSaleId, id -> row("id", id, "afterSaleNo", "AS" + id, "status", "WAIT_AUDIT"));
        boolean approved = Boolean.parseBoolean(String.valueOf(request.getOrDefault("approved", true)));
        item.put("status", approved ? "WAIT_REFUND" : "REJECTED");
        item.put("auditRemark", request.getOrDefault("remark", approved ? "同意售后" : "拒绝售后"));
        return item;
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/refund")
    public Map<String, Object> refundAfterSale(@PathVariable Long afterSaleId) {
        Map<String, Object> item = afterSales.computeIfAbsent(afterSaleId, id -> row("id", id, "afterSaleNo", "AS" + id));
        item.put("status", "COMPLETED");
        item.put("refundStatus", "退款成功");
        return item;
    }

    @GetMapping("/admin/invoices")
    public List<Map<String, Object>> adminInvoices() {
        return new ArrayList<>(invoices.values());
    }

    @GetMapping("/mall/invoices")
    public List<Map<String, Object>> mallInvoices() {
        return adminInvoices();
    }

    @PostMapping("/mall/invoices")
    public Map<String, Object> createInvoice(@RequestBody Map<String, Object> request) {
        long id = System.currentTimeMillis() % 100000;
        Map<String, Object> item = row("id", id, "invoiceApplyNo", "INV" + id, "orderNo", request.getOrDefault("orderNo", "-"), "buyerName", request.getOrDefault("buyerName", "杭州采购王"), "invoiceType", request.getOrDefault("invoiceType", "电子普票"), "title", request.getOrDefault("title", "杭州某某商贸有限公司"), "amount", request.getOrDefault("amount", 560), "status", "WAIT_INVOICE");
        invoices.put(id, item);
        return item;
    }

    @PostMapping("/admin/invoices/{invoiceApplyId}/confirm")
    public Map<String, Object> confirmInvoice(@PathVariable Long invoiceApplyId) {
        Map<String, Object> item = invoices.computeIfAbsent(invoiceApplyId, id -> row("id", id, "invoiceApplyNo", "INV" + id));
        item.put("status", "INVOICED");
        item.put("invoiceNo", "FP" + System.currentTimeMillis() % 100000);
        return item;
    }

    @PostMapping("/admin/invoices/{invoiceApplyId}/reject")
    public Map<String, Object> rejectInvoice(@PathVariable Long invoiceApplyId, @RequestBody Map<String, Object> request) {
        Map<String, Object> item = invoices.computeIfAbsent(invoiceApplyId, id -> row("id", id, "invoiceApplyNo", "INV" + id));
        item.put("status", "REJECTED");
        item.put("rejectReason", request.getOrDefault("reason", "开票资料不完整"));
        return item;
    }

    @GetMapping("/mall/invoice-titles")
    public List<Map<String, Object>> invoiceTitles() {
        return List.of(
            row("id", 1, "titleType", "企业", "title", "杭州某某商贸有限公司", "taxNo", "91330100MA2B2B001X", "isDefault", true),
            row("id", 2, "titleType", "个人", "title", "李先生", "taxNo", "-", "isDefault", false)
        );
    }

    @GetMapping("/system/parameters")
    public Map<String, Object> systemParameters() {
        return row("payTimeoutMinutes", 15, "autoConfirmReceiptDays", 10, "afterSaleDays", 7, "stockWarningThreshold", 50);
    }

    private Long firstProductId() {
        return productRepository.findAll().stream().findFirst().map(Product::id).orElse(1L);
    }

    private Number number(Object value) {
        if (value instanceof Number number) {
            return number;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private void seedWorkflowData() {
        afterSales.put(1L, row("id", 1, "afterSaleNo", "AS202606070001", "orderNo", "SO202606040010", "buyerName", "上海宏达采购", "type", "ONLY_REFUND", "productName", "康师傅冰红茶 500ml/15瓶", "quantity", 2, "refundAmount", 72, "status", "WAIT_AUDIT", "createdAt", "2026-06-07 10:20"));
        afterSales.put(2L, row("id", 2, "afterSaleNo", "AS202606070003", "orderNo", "SO202606050012", "buyerName", "宁波云仓采购", "type", "RETURN_REFUND", "productName", "娃哈哈 596ml/24瓶", "quantity", 3, "refundAmount", 126, "status", "WAIT_RETURN_RECEIVE", "createdAt", "2026-06-07 10:45"));
        invoices.put(1L, row("id", 1, "invoiceApplyNo", "INV202606070001", "orderNo", "SO202606050021", "buyerName", "杭州某某商贸", "invoiceType", "电子普票", "titleType", "企业", "title", "杭州某某商贸有限公司", "amount", 2860, "status", "WAIT_INVOICE"));
        invoices.put(2L, row("id", 2, "invoiceApplyNo", "INV202606070002", "orderNo", "SO202606040018", "buyerName", "苏州瑞丰食品", "invoiceType", "电子专票", "titleType", "企业", "title", "苏州瑞丰食品有限公司", "amount", 6420, "status", "INVOICED"));
    }

    private Map<String, Object> row(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }
}
