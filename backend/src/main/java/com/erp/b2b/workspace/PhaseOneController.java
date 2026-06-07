package com.erp.b2b.workspace;

import com.erp.b2b.common.ApiException;
import com.erp.b2b.inventory.InventoryRepository;
import com.erp.b2b.order.OrderService;
import com.erp.b2b.product.CreateProductRequest;
import com.erp.b2b.product.Product;
import com.erp.b2b.product.ProductRepository;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
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
    private final JdbcClient jdbcClient;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderService orderService;

    public PhaseOneController(JdbcClient jdbcClient, ProductRepository productRepository, InventoryRepository inventoryRepository, OrderService orderService) {
        this.jdbcClient = jdbcClient;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderService = orderService;
    }

    @GetMapping("/admin/summary")
    public Map<String, Object> adminSummary() {
        var products = productRepository.findAll();
        var orders = orderService.listOrders();
        long pendingAfterSale = count("SELECT COUNT(*) FROM after_sale_orders WHERE after_sale_status NOT IN ('COMPLETED','REJECTED')");
        long pendingInvoice = count("SELECT COUNT(*) FROM invoice_applies WHERE invoice_status = 'WAIT_INVOICE'");
        return row(
            "todayOrders", orders.size(),
            "todayPaymentAmount", payments().stream().map(item -> new BigDecimal(String.valueOf(item.get("amount")))).reduce(BigDecimal.ZERO, BigDecimal::add),
            "saleableSkus", products.stream().filter(product -> "ON_SALE".equals(product.saleStatus())).count(),
            "stockWarning", products.stream().filter(product -> product.stockQuantity() <= stockWarningThreshold()).count(),
            "pendingAfterSale", pendingAfterSale,
            "pendingInvoice", pendingInvoice,
            "todoCards", List.of(
                row("module", "采购管理", "title", "待入库采购单", "count", count("SELECT COUNT(*) FROM purchase_orders WHERE purchase_status IN ('WAIT_STOCK_IN','PART_STOCK_IN')"), "target", "purchase"),
                row("module", "订单管理", "title", "待发货订单", "count", orders.stream().filter(order -> "WAIT_SHIP".equals(order.orderStatus())).count(), "target", "orders"),
                row("module", "售后管理", "title", "待审核售后", "count", count("SELECT COUNT(*) FROM after_sale_orders WHERE after_sale_status = 'WAIT_AUDIT'"), "target", "afterSales"),
                row("module", "开票管理", "title", "待开票申请", "count", pendingInvoice, "target", "invoices")
            )
        );
    }

    @PostMapping("/admin/login")
    public Map<String, Object> adminLogin(@RequestBody Map<String, Object> request) {
        String accountName = string(request.getOrDefault("username", "admin"));
        Map<String, Object> account = jdbcClient.sql("""
            SELECT account_name, real_name, role_name, account_status
            FROM admin_accounts
            WHERE account_name = :accountName
            """)
            .param("accountName", accountName)
            .query(this::mapRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Admin account not found"));
        if (!"ENABLED".equals(account.get("accountStatus"))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin account is disabled");
        }
        return row("token", "admin-token-" + accountName, "accountName", account.get("accountName"), "realName", account.get("realName"), "role", account.get("roleName"));
    }

    @GetMapping("/admin/accounts")
    public List<Map<String, Object>> adminAccounts() {
        return rows("""
            SELECT id, account_name, real_name, phone, role_name, account_status AS status, created_at, updated_at
            FROM admin_accounts
            ORDER BY id
            """);
    }

    @PostMapping("/admin/accounts")
    public Map<String, Object> createAdminAccount(@RequestBody Map<String, Object> request) {
        String accountName = requiredString(request, "accountName");
        String realName = requiredString(request, "realName");
        String phone = requiredString(request, "phone");
        String roleName = requiredString(request, "roleName");
        jdbcClient.sql("""
            INSERT INTO admin_accounts (account_name, real_name, phone, role_name, account_status)
            VALUES (:accountName, :realName, :phone, :roleName, 'ENABLED')
            """)
            .param("accountName", accountName)
            .param("realName", realName)
            .param("phone", phone)
            .param("roleName", roleName)
            .update();
        log("系统管理", "新增后台账号", accountName, "新增账号 " + accountName);
        return one("SELECT * FROM admin_accounts WHERE account_name = :accountName", "accountName", accountName);
    }

    @PutMapping("/admin/accounts/{accountId}")
    public Map<String, Object> updateAdminAccount(@PathVariable Long accountId, @RequestBody Map<String, Object> request) {
        String realName = requiredString(request, "realName");
        String phone = requiredString(request, "phone");
        String roleName = requiredString(request, "roleName");
        jdbcClient.sql("""
            UPDATE admin_accounts
            SET real_name = :realName, phone = :phone, role_name = :roleName
            WHERE id = :id
            """)
            .param("realName", realName)
            .param("phone", phone)
            .param("roleName", roleName)
            .param("id", accountId)
            .update();
        log("系统管理", "编辑后台账号", String.valueOf(accountId), "编辑后台账号资料");
        return one("SELECT * FROM admin_accounts WHERE id = :id", "id", accountId);
    }

    @PutMapping("/admin/accounts/{accountId}/status")
    public Map<String, Object> updateAdminAccountStatus(@PathVariable Long accountId, @RequestBody Map<String, Object> request) {
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        jdbcClient.sql("UPDATE admin_accounts SET account_status = :status WHERE id = :id")
            .param("status", status)
            .param("id", accountId)
            .update();
        log("系统管理", "启用/禁用账号", String.valueOf(accountId), "账号状态更新为 " + status);
        return one("SELECT * FROM admin_accounts WHERE id = :id", "id", accountId);
    }

    @GetMapping("/admin/roles")
    public List<Map<String, Object>> adminRoles() {
        return rows("""
            SELECT id, role_name, role_desc AS description, account_count, role_status AS status, created_at, updated_at
            FROM admin_roles
            ORDER BY id
            """);
    }

    @PostMapping("/admin/roles")
    public Map<String, Object> createRole(@RequestBody Map<String, Object> request) {
        String roleName = requiredString(request, "roleName");
        String roleDesc = requiredString(request, "roleDesc");
        jdbcClient.sql("""
            INSERT INTO admin_roles (role_name, role_desc, account_count, role_status)
            VALUES (:roleName, :roleDesc, 0, 'ENABLED')
            """)
            .param("roleName", roleName)
            .param("roleDesc", roleDesc)
            .update();
        log("系统管理", "新增角色", roleName, "新增角色 " + roleName);
        return one("SELECT * FROM admin_roles WHERE role_name = :roleName", "roleName", roleName);
    }

    @PutMapping("/admin/roles/{roleId}")
    public Map<String, Object> updateRole(@PathVariable Long roleId, @RequestBody Map<String, Object> request) {
        String roleName = requiredString(request, "roleName");
        String roleDesc = requiredString(request, "roleDesc");
        jdbcClient.sql("""
            UPDATE admin_roles
            SET role_name = :roleName, role_desc = :roleDesc
            WHERE id = :id
            """)
            .param("roleName", roleName)
            .param("roleDesc", roleDesc)
            .param("id", roleId)
            .update();
        log("系统管理", "编辑角色", String.valueOf(roleId), "编辑角色资料");
        return one("SELECT * FROM admin_roles WHERE id = :id", "id", roleId);
    }

    @GetMapping("/admin/permissions/tree")
    public List<Map<String, Object>> permissionTree() {
        return List.of(
            row("module", "商品管理", "actions", List.of("查看", "新增", "编辑", "上架", "下架")),
            row("module", "采购管理", "actions", List.of("供应商维护", "采购单维护", "采购入库")),
            row("module", "库存管理", "actions", List.of("库存总览", "库存流水", "库存调整", "预警设置")),
            row("module", "订单管理", "actions", List.of("查看", "发货", "取消", "确认收货")),
            row("module", "售后管理", "actions", List.of("审核", "确认退货收货", "退款")),
            row("module", "开票管理", "actions", List.of("上传发票", "确认开票", "驳回")),
            row("module", "财务管理", "actions", List.of("支付记录", "退款记录", "异常查看")),
            row("module", "系统管理", "actions", List.of("账号", "角色", "日志", "基础配置"))
        );
    }

    @GetMapping("/admin/product-categories")
    public List<Map<String, Object>> productCategories() {
        return rows("""
            SELECT id, category_name, parent_name, sort_no, category_status AS status, created_at, updated_at
            FROM product_categories
            ORDER BY sort_no, id
            """);
    }

    @PostMapping("/admin/product-categories")
    public Map<String, Object> createProductCategory(@RequestBody Map<String, Object> request) {
        String categoryName = requiredString(request, "categoryName");
        jdbcClient.sql("""
            INSERT INTO product_categories (category_name, parent_name, sort_no, category_status)
            VALUES (:categoryName, :parentName, :sortNo, 'ENABLED')
            """)
            .param("categoryName", categoryName)
            .param("parentName", string(request.getOrDefault("parentName", "-")))
            .param("sortNo", requiredInt(request, "sortNo"))
            .update();
        log("商品管理", "新增商品分类", categoryName, "新增商品分类");
        return rows("SELECT * FROM product_categories ORDER BY id DESC").get(0);
    }

    @PutMapping("/admin/product-categories/{categoryId}")
    public Map<String, Object> updateProductCategory(@PathVariable Long categoryId, @RequestBody Map<String, Object> request) {
        String categoryName = requiredString(request, "categoryName");
        jdbcClient.sql("""
            UPDATE product_categories
            SET category_name = :categoryName, parent_name = :parentName, sort_no = :sortNo
            WHERE id = :id
            """)
            .param("categoryName", categoryName)
            .param("parentName", string(request.getOrDefault("parentName", "-")))
            .param("sortNo", requiredInt(request, "sortNo"))
            .param("id", categoryId)
            .update();
        log("商品管理", "编辑商品分类", String.valueOf(categoryId), "编辑商品分类");
        return one("SELECT * FROM product_categories WHERE id = :id", "id", categoryId);
    }

    @PutMapping("/admin/product-categories/{categoryId}/status")
    public Map<String, Object> updateProductCategoryStatus(@PathVariable Long categoryId, @RequestBody Map<String, Object> request) {
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        jdbcClient.sql("UPDATE product_categories SET category_status = :status WHERE id = :id")
            .param("status", status)
            .param("id", categoryId)
            .update();
        log("商品管理", "启用/停用商品分类", String.valueOf(categoryId), "商品分类状态更新为 " + status);
        return one("SELECT * FROM product_categories WHERE id = :id", "id", categoryId);
    }

    @GetMapping("/admin/product-brands")
    public List<Map<String, Object>> productBrands() {
        return rows("""
            SELECT id, brand_name, first_letter, sort_no, brand_status AS status, created_at, updated_at
            FROM product_brands
            ORDER BY sort_no, id
            """);
    }

    @PostMapping("/admin/product-brands")
    public Map<String, Object> createProductBrand(@RequestBody Map<String, Object> request) {
        String brandName = requiredString(request, "brandName");
        jdbcClient.sql("""
            INSERT INTO product_brands (brand_name, first_letter, sort_no, brand_status)
            VALUES (:brandName, :firstLetter, :sortNo, 'ENABLED')
            """)
            .param("brandName", brandName)
            .param("firstLetter", string(request.getOrDefault("firstLetter", "")))
            .param("sortNo", requiredInt(request, "sortNo"))
            .update();
        log("商品管理", "新增商品品牌", brandName, "新增商品品牌");
        return rows("SELECT * FROM product_brands ORDER BY id DESC").get(0);
    }

    @PutMapping("/admin/product-brands/{brandId}")
    public Map<String, Object> updateProductBrand(@PathVariable Long brandId, @RequestBody Map<String, Object> request) {
        String brandName = requiredString(request, "brandName");
        jdbcClient.sql("""
            UPDATE product_brands
            SET brand_name = :brandName, first_letter = :firstLetter, sort_no = :sortNo
            WHERE id = :id
            """)
            .param("brandName", brandName)
            .param("firstLetter", string(request.getOrDefault("firstLetter", "")))
            .param("sortNo", requiredInt(request, "sortNo"))
            .param("id", brandId)
            .update();
        log("商品管理", "编辑商品品牌", String.valueOf(brandId), "编辑商品品牌");
        return one("SELECT * FROM product_brands WHERE id = :id", "id", brandId);
    }

    @PutMapping("/admin/product-brands/{brandId}/status")
    public Map<String, Object> updateProductBrandStatus(@PathVariable Long brandId, @RequestBody Map<String, Object> request) {
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        jdbcClient.sql("UPDATE product_brands SET brand_status = :status WHERE id = :id")
            .param("status", status)
            .param("id", brandId)
            .update();
        log("商品管理", "启用/停用商品品牌", String.valueOf(brandId), "商品品牌状态更新为 " + status);
        return one("SELECT * FROM product_brands WHERE id = :id", "id", brandId);
    }

    @GetMapping("/admin/products")
    public List<Product> adminProducts() {
        return productRepository.findAll();
    }

    @PostMapping("/admin/products")
    public Product createAdminProduct(@Valid @RequestBody CreateProductRequest request) {
        long suffix = System.currentTimeMillis();
        Product product = productRepository.create(request, "P-" + suffix, "SKU-" + suffix);
        log("商品管理", "新增商品", product.productCode(), "新增商品 " + product.productName());
        return product;
    }

    @PutMapping("/admin/products/{productId}")
    public Product updateAdminProduct(@PathVariable Long productId, @Valid @RequestBody CreateProductRequest request) {
        Product product = productRepository.update(productId, request);
        log("商品管理", "编辑商品", product.productCode(), "编辑商品 " + product.productName());
        return product;
    }

    @PutMapping("/admin/products/{productId}/on-sale")
    public Product onSale(@PathVariable Long productId) {
        productRepository.setSaleStatus(productId, "ON_SALE");
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        log("商品管理", "商品上架", product.productCode(), "商品上架 " + product.productName());
        return product;
    }

    @PutMapping("/admin/products/{productId}/off-sale")
    public Product offSale(@PathVariable Long productId) {
        productRepository.setSaleStatus(productId, "OFF_SALE");
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        log("商品管理", "商品下架", product.productCode(), "商品下架 " + product.productName());
        return product;
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
        return row("buyerNo", "B" + System.currentTimeMillis() % 1000000, "phone", request.get("phone"), "status", "ENABLED", "auditRequired", false);
    }

    @PostMapping("/buyer/login")
    public Map<String, Object> buyerLogin(@RequestBody Map<String, Object> request) {
        return row("token", "buyer-token", "phone", request.getOrDefault("phone", "13800010001"), "buyerName", "杭州采购王");
    }

    @PostMapping("/buyer/password/update")
    public Map<String, Object> updateBuyerPassword() {
        return row("updated", true);
    }

    @GetMapping("/buyer/profile")
    public Map<String, Object> buyerProfile() {
        return row("buyerNo", "B000001", "buyerName", "杭州采购王", "companyName", "杭州某某商贸有限公司", "phone", "13800010001", "accountStatus", "ENABLED");
    }

    @GetMapping("/mall/cart")
    public Map<String, Object> mallCart() {
        List<Map<String, Object>> items = productRepository.findAll().stream().limit(2).map(product -> row(
            "cartItemId", product.id(),
            "productId", product.id(),
            "productName", product.productName(),
            "skuName", product.skuName(),
            "quantity", product.minOrderQuantity(),
            "salePrice", product.salePrice(),
            "checked", true
        )).toList();
        BigDecimal checkedAmount = items.stream()
            .map(item -> new BigDecimal(String.valueOf(item.get("salePrice"))).multiply(BigDecimal.valueOf(Long.parseLong(String.valueOf(item.get("quantity"))))))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return row("checkedAmount", checkedAmount, "items", items);
    }

    @PostMapping("/mall/cart/items")
    public Map<String, Object> addCartItem(@RequestBody Map<String, Object> request) {
        Long productId = requiredLong(request, "productId");
        int quantity = positiveInt(request, "quantity");
        productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        return row("cartItemId", System.currentTimeMillis() % 100000, "productId", productId, "quantity", quantity, "checked", true);
    }

    @GetMapping("/mall/cart/count")
    public Map<String, Object> mallCartCount() {
        return row("count", 2);
    }

    @GetMapping("/admin/suppliers")
    public List<Map<String, Object>> suppliers() {
        return rows("""
            SELECT id, supplier_no, supplier_name, contact_name, contact_phone AS phone, address, supplier_status AS status, purchase_count, purchase_amount, created_at, updated_at
            FROM suppliers
            ORDER BY id
            """);
    }

    @PostMapping("/admin/suppliers")
    public Map<String, Object> createSupplier(@RequestBody Map<String, Object> request) {
        String supplierName = requiredString(request, "supplierName");
        String contactName = requiredString(request, "contactName");
        String contactPhone = requiredString(request, "contactPhone");
        String supplierNo = "SUP" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO suppliers (supplier_no, supplier_name, contact_name, contact_phone, address, supplier_status)
            VALUES (:supplierNo, :supplierName, :contactName, :contactPhone, :address, 'ENABLED')
            """)
            .param("supplierNo", supplierNo)
            .param("supplierName", supplierName)
            .param("contactName", contactName)
            .param("contactPhone", contactPhone)
            .param("address", string(request.getOrDefault("address", "")))
            .update();
        log("采购管理", "新增供应商", supplierNo, "新增供应商 " + request.getOrDefault("supplierName", "新供应商"));
        return one("SELECT * FROM suppliers WHERE supplier_no = :supplierNo", "supplierNo", supplierNo);
    }

    @PutMapping("/admin/suppliers/{supplierId}")
    public Map<String, Object> updateSupplier(@PathVariable Long supplierId, @RequestBody Map<String, Object> request) {
        String supplierName = requiredString(request, "supplierName");
        String contactName = requiredString(request, "contactName");
        String contactPhone = requiredString(request, "contactPhone");
        jdbcClient.sql("""
            UPDATE suppliers
            SET supplier_name = :supplierName,
                contact_name = :contactName,
                contact_phone = :contactPhone,
                address = :address
            WHERE id = :id
            """)
            .param("supplierName", supplierName)
            .param("contactName", contactName)
            .param("contactPhone", contactPhone)
            .param("address", string(request.getOrDefault("address", "")))
            .param("id", supplierId)
            .update();
        log("采购管理", "编辑供应商", String.valueOf(supplierId), "编辑供应商 " + supplierName);
        return one("SELECT * FROM suppliers WHERE id = :id", "id", supplierId);
    }

    @PutMapping("/admin/suppliers/{supplierId}/status")
    public Map<String, Object> updateSupplierStatus(@PathVariable Long supplierId, @RequestBody Map<String, Object> request) {
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        jdbcClient.sql("UPDATE suppliers SET supplier_status = :status WHERE id = :id")
            .param("status", status)
            .param("id", supplierId)
            .update();
        log("采购管理", "启用/停用供应商", String.valueOf(supplierId), "供应商状态更新为 " + status);
        return one("SELECT * FROM suppliers WHERE id = :id", "id", supplierId);
    }

    @GetMapping("/admin/purchase-orders")
    public List<Map<String, Object>> purchaseOrders() {
        return rows("""
            SELECT id, purchase_no, supplier_id, supplier_name, product_id AS target_product_id, product_name, sku_code,
                   1 AS sku_count, purchase_qty, stocked_qty, purchase_price, purchase_amount AS amount,
                   expected_arrival_date, purchase_status AS status, remark, created_at, updated_at
            FROM purchase_orders
            ORDER BY id DESC
            """);
    }

    @PostMapping("/admin/purchase-orders")
    public Map<String, Object> createPurchaseOrder(@RequestBody Map<String, Object> request) {
        Long supplierId = requiredLong(request, "supplierId");
        Long productId = requiredLong(request, "productId");
        int quantity = positiveInt(request, "quantity");
        BigDecimal price = positiveMoney(request, "purchasePrice");
        Map<String, Object> supplier = one("SELECT * FROM suppliers WHERE id = :id", "id", supplierId);
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        String purchaseNo = "PO" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO purchase_orders (purchase_no, supplier_id, supplier_name, product_id, product_name, sku_code,
              purchase_qty, stocked_qty, purchase_price, purchase_amount, expected_arrival_date, purchase_status, remark)
            VALUES (:purchaseNo, :supplierId, :supplierName, :productId, :productName, :skuCode,
              :quantity, 0, :price, :amount, :expectedArrivalDate, 'WAIT_STOCK_IN', :remark)
            """)
            .param("purchaseNo", purchaseNo)
            .param("supplierId", supplierId)
            .param("supplierName", supplier.get("supplierName"))
            .param("productId", productId)
            .param("productName", product.productName())
            .param("skuCode", product.skuCode())
            .param("quantity", quantity)
            .param("price", price)
            .param("amount", price.multiply(BigDecimal.valueOf(quantity)))
            .param("expectedArrivalDate", string(request.getOrDefault("expectedArrivalDate", LocalDate.now().plusDays(3).toString())))
            .param("remark", string(request.getOrDefault("remark", "")))
            .update();
        jdbcClient.sql("UPDATE suppliers SET purchase_count = purchase_count + 1, purchase_amount = purchase_amount + :amount WHERE id = :id")
            .param("amount", price.multiply(BigDecimal.valueOf(quantity)))
            .param("id", supplierId)
            .update();
        log("采购管理", "新增采购订单", purchaseNo, "新增采购订单 " + purchaseNo);
        return one("SELECT * FROM purchase_orders WHERE purchase_no = :purchaseNo", "purchaseNo", purchaseNo);
    }

    @PutMapping("/admin/purchase-orders/{purchaseOrderId}")
    public Map<String, Object> updatePurchaseOrder(@PathVariable Long purchaseOrderId, @RequestBody Map<String, Object> request) {
        Map<String, Object> current = one("SELECT * FROM purchase_orders WHERE id = :id", "id", purchaseOrderId);
        if (!"WAIT_STOCK_IN".equals(current.get("purchaseStatus"))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only waiting purchase orders can be edited");
        }
        Long supplierId = requiredLong(request, "supplierId");
        Long productId = requiredLong(request, "productId");
        int quantity = positiveInt(request, "quantity");
        BigDecimal price = positiveMoney(request, "purchasePrice");
        Map<String, Object> supplier = one("SELECT * FROM suppliers WHERE id = :id", "id", supplierId);
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        jdbcClient.sql("""
            UPDATE purchase_orders
            SET supplier_id = :supplierId,
                supplier_name = :supplierName,
                product_id = :productId,
                product_name = :productName,
                sku_code = :skuCode,
                purchase_qty = :quantity,
                purchase_price = :price,
                purchase_amount = :amount,
                expected_arrival_date = :expectedArrivalDate,
                remark = :remark
            WHERE id = :id
            """)
            .param("supplierId", supplierId)
            .param("supplierName", supplier.get("supplierName"))
            .param("productId", productId)
            .param("productName", product.productName())
            .param("skuCode", product.skuCode())
            .param("quantity", quantity)
            .param("price", price)
            .param("amount", price.multiply(BigDecimal.valueOf(quantity)))
            .param("expectedArrivalDate", string(request.getOrDefault("expectedArrivalDate", LocalDate.now().plusDays(3).toString())))
            .param("remark", string(request.getOrDefault("remark", "")))
            .param("id", purchaseOrderId)
            .update();
        log("采购管理", "编辑采购订单", String.valueOf(purchaseOrderId), "编辑采购订单");
        return one("SELECT * FROM purchase_orders WHERE id = :id", "id", purchaseOrderId);
    }

    @PostMapping("/admin/purchase-orders/{purchaseOrderId}/cancel")
    public Map<String, Object> cancelPurchaseOrder(@PathVariable Long purchaseOrderId) {
        jdbcClient.sql("UPDATE purchase_orders SET purchase_status = 'CANCELLED' WHERE id = :id AND purchase_status <> 'COMPLETED'")
            .param("id", purchaseOrderId)
            .update();
        log("采购管理", "取消采购订单", String.valueOf(purchaseOrderId), "取消采购订单");
        return one("SELECT * FROM purchase_orders WHERE id = :id", "id", purchaseOrderId);
    }

    @PostMapping("/admin/purchase-orders/{purchaseOrderId}/stock-in")
    @Transactional
    public Map<String, Object> stockIn(@PathVariable Long purchaseOrderId, @RequestBody Map<String, Object> request) {
        Map<String, Object> order = one("SELECT * FROM purchase_orders WHERE id = :id", "id", purchaseOrderId);
        if ("COMPLETED".equals(order.get("purchaseStatus")) || "CANCELLED".equals(order.get("purchaseStatus"))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Purchase order cannot be stocked in");
        }
        Long productId = Long.parseLong(String.valueOf(order.get("productId")));
        int waitQty = Integer.parseInt(String.valueOf(order.get("purchaseQty"))) - Integer.parseInt(String.valueOf(order.get("stockedQty")));
        int quantity = Math.min(positiveInt(request, "quantity"), waitQty);
        if (quantity <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No quantity can be stocked in");
        }
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        productRepository.addStock(productId, quantity);
        Product latest = productRepository.findById(productId).orElseThrow();
        BigDecimal price = new BigDecimal(String.valueOf(order.get("purchasePrice")));
        String stockInNo = "IN" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO purchase_stock_ins (stock_in_no, purchase_order_id, purchase_no, supplier_name, product_id, product_name, sku_code, stock_in_qty, stock_in_amount, operator_name)
            VALUES (:stockInNo, :purchaseOrderId, :purchaseNo, :supplierName, :productId, :productName, :skuCode, :quantity, :amount, :operatorName)
            """)
            .param("stockInNo", stockInNo)
            .param("purchaseOrderId", purchaseOrderId)
            .param("purchaseNo", order.get("purchaseNo"))
            .param("supplierName", order.get("supplierName"))
            .param("productId", productId)
            .param("productName", product.productName())
            .param("skuCode", product.skuCode())
            .param("quantity", quantity)
            .param("amount", price.multiply(BigDecimal.valueOf(quantity)))
            .param("operatorName", string(request.getOrDefault("operatorName", "仓库王")))
            .update();
        int stockedQty = Integer.parseInt(String.valueOf(order.get("stockedQty"))) + quantity;
        String nextStatus = stockedQty >= Integer.parseInt(String.valueOf(order.get("purchaseQty"))) ? "COMPLETED" : "PART_STOCK_IN";
        jdbcClient.sql("UPDATE purchase_orders SET stocked_qty = :stockedQty, purchase_status = :status WHERE id = :id")
            .param("stockedQty", stockedQty)
            .param("status", nextStatus)
            .param("id", purchaseOrderId)
            .update();
        inventoryRepository.insertMovement(productId, "PURCHASE_STOCK_IN", quantity, latest.stockQuantity(), "PURCHASE_ORDER", stockInNo, "采购入库：" + product.productName());
        log("采购管理", "采购入库", stockInNo, "采购入库 " + quantity + " 件");
        return row("stockInNo", stockInNo, "purchaseOrderId", purchaseOrderId, "productId", productId, "quantity", quantity, "stockAfter", latest.stockQuantity(), "status", nextStatus);
    }

    @GetMapping("/admin/purchase-stock-ins")
    public List<Map<String, Object>> purchaseStockIns() {
        return rows("""
            SELECT id, stock_in_no, purchase_no, supplier_name, product_name, sku_code, stock_in_qty, stock_in_amount, operator_name, created_at
            FROM purchase_stock_ins
            ORDER BY id DESC
            """);
    }

    @GetMapping("/admin/inventory")
    public List<Map<String, Object>> inventoryOverview() {
        int warning = stockWarningThreshold();
        return productRepository.findAll().stream()
            .map(product -> row(
                "productId", product.id(),
                "productName", product.productName(),
                "skuCode", product.skuCode(),
                "actualStock", product.stockQuantity(),
                "occupiedStock", 0,
                "saleableStock", product.stockQuantity(),
                "soldQty", soldQty(product.id()),
                "warningThreshold", warning,
                "inventoryStatus", product.stockQuantity() <= warning ? "WARNING" : "NORMAL"
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
        Long productId = requiredLong(request, "productId");
        int quantity = requiredInt(request, "quantity");
        if (quantity == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity cannot be zero");
        }
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        if (quantity > 0) {
            productRepository.addStock(productId, quantity);
        } else {
            productRepository.deductStock(productId, Math.abs(quantity));
        }
        Product latest = productRepository.findById(productId).orElseThrow();
        String adjustmentNo = "ADJ" + System.currentTimeMillis() % 100000;
        inventoryRepository.insertMovement(productId, "MANUAL_ADJUST", quantity, latest.stockQuantity(), "INVENTORY_ADJUSTMENT", adjustmentNo, "库存调整：" + product.productName());
        log("库存管理", "库存调整", adjustmentNo, "库存调整 " + quantity);
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

    @PostMapping("/mall/orders/confirm")
    public Map<String, Object> confirmOrder(@RequestBody Map<String, Object> request) {
        return row("confirmed", true, "items", request.getOrDefault("items", List.of()), "receiverAddress", request.getOrDefault("receiverAddress", "默认收货地址"));
    }

    @PostMapping("/mall/orders/{orderId}/cancel")
    public Object cancelOrder(@PathVariable Long orderId) {
        jdbcClient.sql("UPDATE sales_orders SET order_status = 'CANCELLED' WHERE id = :id AND order_status = 'WAIT_PAY'")
            .param("id", orderId)
            .update();
        log("订单管理", "取消订单", String.valueOf(orderId), "买家取消待支付订单");
        return orderService.getOrder(orderId);
    }

    @PostMapping("/mall/orders/{orderId}/confirm-receipt")
    public Object confirmReceipt(@PathVariable Long orderId) {
        Object order = orderService.complete(orderId);
        log("订单管理", "确认收货", String.valueOf(orderId), "买家确认收货");
        return order;
    }

    @PostMapping("/mall/payments")
    public Map<String, Object> createPayment(@RequestBody Map<String, Object> request) {
        Long orderId = requiredLong(request, "orderId");
        var order = orderService.markPaid(orderId);
        String paymentNo = "PAY" + order.orderNo().replace("SO", "");
        log("财务管理", "支付成功", paymentNo, "订单支付成功");
        return row("paymentId", paymentNo, "orderId", orderId, "paymentStatus", order.paymentStatus(), "orderStatus", order.orderStatus(), "amount", order.totalAmount());
    }

    @GetMapping("/mall/payments/{paymentId}/status")
    public Map<String, Object> paymentStatus(@PathVariable String paymentId) {
        return row("paymentId", paymentId, "paymentStatus", "PAID");
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
        return rows("""
            SELECT CONCAT('RF', id) AS refund_no, after_sale_no, order_no, buyer_name, 'ORIGINAL' AS refund_method,
                   refund_amount AS amount, COALESCE(refund_status, 'WAIT_REFUND') AS refund_status, updated_at AS refunded_at
            FROM after_sale_orders
            WHERE refund_status IS NOT NULL OR after_sale_status IN ('WAIT_REFUND','COMPLETED')
            ORDER BY id DESC
            """);
    }

    @GetMapping("/admin/finance/payment-exceptions")
    public List<Map<String, Object>> paymentExceptions() {
        return List.of();
    }

    @GetMapping("/admin/after-sales")
    public List<Map<String, Object>> afterSales() {
        return rows("""
            SELECT id, after_sale_no, order_no, buyer_name, after_sale_type AS type, product_name, quantity, refund_amount, after_sale_status AS status, reason, audit_remark, refund_status, created_at, updated_at
            FROM after_sale_orders
            ORDER BY id DESC
            """);
    }

    @GetMapping("/mall/after-sales")
    public List<Map<String, Object>> mallAfterSales() {
        return afterSales();
    }

    @PostMapping({"/mall/after-sales", "/admin/after-sales"})
    public Map<String, Object> createAfterSale(@RequestBody Map<String, Object> request) {
        String orderNo = requiredString(request, "orderNo");
        String productName = requiredString(request, "productName");
        int quantity = positiveInt(request, "quantity");
        BigDecimal refundAmount = nonNegativeMoney(request, "refundAmount");
        String afterSaleNo = "AS" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO after_sale_orders (after_sale_no, order_no, buyer_name, after_sale_type, product_name, quantity, refund_amount, after_sale_status, reason)
            VALUES (:afterSaleNo, :orderNo, :buyerName, :type, :productName, :quantity, :refundAmount, 'WAIT_AUDIT', :reason)
            """)
            .param("afterSaleNo", afterSaleNo)
            .param("orderNo", orderNo)
            .param("buyerName", string(request.getOrDefault("buyerName", "杭州采购王")))
            .param("type", string(request.getOrDefault("type", "ONLY_REFUND")))
            .param("productName", productName)
            .param("quantity", quantity)
            .param("refundAmount", refundAmount)
            .param("reason", string(request.getOrDefault("reason", "买家申请售后")))
            .update();
        log("售后管理", "提交售后", afterSaleNo, "提交售后申请");
        return one("SELECT * FROM after_sale_orders WHERE after_sale_no = :afterSaleNo", "afterSaleNo", afterSaleNo);
    }

    @PostMapping("/mall/after-sales/{afterSaleId}/cancel")
    public Map<String, Object> cancelAfterSale(@PathVariable Long afterSaleId) {
        jdbcClient.sql("UPDATE after_sale_orders SET after_sale_status = 'CANCELLED' WHERE id = :id AND after_sale_status = 'WAIT_AUDIT'")
            .param("id", afterSaleId)
            .update();
        return one("SELECT * FROM after_sale_orders WHERE id = :id", "id", afterSaleId);
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/audit")
    public Map<String, Object> auditAfterSale(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        boolean approved = Boolean.parseBoolean(String.valueOf(request.getOrDefault("approved", true)));
        String status = approved ? "WAIT_REFUND" : "REJECTED";
        String remark = requiredString(request, "remark");
        jdbcClient.sql("UPDATE after_sale_orders SET after_sale_status = :status, audit_remark = :remark WHERE id = :id")
            .param("status", status)
            .param("remark", remark)
            .param("id", afterSaleId)
            .update();
        log("售后管理", "售后审核", String.valueOf(afterSaleId), "售后审核 " + status);
        return one("SELECT * FROM after_sale_orders WHERE id = :id", "id", afterSaleId);
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/confirm-return-received")
    public Map<String, Object> confirmReturnReceived(@PathVariable Long afterSaleId) {
        jdbcClient.sql("UPDATE after_sale_orders SET after_sale_status = 'WAIT_REFUND' WHERE id = :id")
            .param("id", afterSaleId)
            .update();
        log("售后管理", "确认退货收货", String.valueOf(afterSaleId), "确认退货收货");
        return one("SELECT * FROM after_sale_orders WHERE id = :id", "id", afterSaleId);
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/refund")
    public Map<String, Object> refundAfterSale(@PathVariable Long afterSaleId) {
        jdbcClient.sql("UPDATE after_sale_orders SET after_sale_status = 'COMPLETED', refund_status = 'SUCCESS' WHERE id = :id")
            .param("id", afterSaleId)
            .update();
        log("售后管理", "退款处理", String.valueOf(afterSaleId), "售后退款成功");
        return one("SELECT * FROM after_sale_orders WHERE id = :id", "id", afterSaleId);
    }

    @GetMapping("/admin/invoices")
    public List<Map<String, Object>> adminInvoices() {
        return rows("""
            SELECT id, invoice_apply_no, order_no, buyer_name, invoice_type, title_type, invoice_title AS title,
                   apply_amount AS amount, receive_email, invoice_status AS status, invoice_no, reject_reason, created_at, updated_at
            FROM invoice_applies
            ORDER BY id DESC
            """);
    }

    @GetMapping("/mall/invoices")
    public List<Map<String, Object>> mallInvoices() {
        return adminInvoices();
    }

    @PostMapping("/mall/invoices")
    public Map<String, Object> createInvoice(@RequestBody Map<String, Object> request) {
        String orderNo = requiredString(request, "orderNo");
        String invoiceTitle = requiredString(request, request.containsKey("title") ? "title" : "invoiceTitle");
        BigDecimal amount = nonNegativeMoney(request, "amount");
        String email = requiredEmail(request, request.containsKey("email") ? "email" : "receiveEmail");
        String invoiceApplyNo = "INV" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO invoice_applies (invoice_apply_no, order_no, buyer_name, invoice_type, title_type, invoice_title, apply_amount, receive_email, invoice_status)
            VALUES (:invoiceApplyNo, :orderNo, :buyerName, :invoiceType, :titleType, :invoiceTitle, :amount, :email, 'WAIT_INVOICE')
            """)
            .param("invoiceApplyNo", invoiceApplyNo)
            .param("orderNo", orderNo)
            .param("buyerName", string(request.getOrDefault("buyerName", "杭州采购王")))
            .param("invoiceType", string(request.getOrDefault("invoiceType", "E_NORMAL")))
            .param("titleType", string(request.getOrDefault("titleType", "COMPANY")))
            .param("invoiceTitle", invoiceTitle)
            .param("amount", amount)
            .param("email", email)
            .update();
        log("开票管理", "提交开票申请", invoiceApplyNo, "提交开票申请");
        return one("SELECT * FROM invoice_applies WHERE invoice_apply_no = :invoiceApplyNo", "invoiceApplyNo", invoiceApplyNo);
    }

    @PostMapping("/admin/invoices/{invoiceApplyId}/confirm")
    public Map<String, Object> confirmInvoice(@PathVariable Long invoiceApplyId) {
        String invoiceNo = "FP" + System.currentTimeMillis() % 100000;
        jdbcClient.sql("UPDATE invoice_applies SET invoice_status = 'INVOICED', invoice_no = :invoiceNo WHERE id = :id")
            .param("invoiceNo", invoiceNo)
            .param("id", invoiceApplyId)
            .update();
        log("开票管理", "确认开票", String.valueOf(invoiceApplyId), "确认开票 " + invoiceNo);
        return one("SELECT * FROM invoice_applies WHERE id = :id", "id", invoiceApplyId);
    }

    @PostMapping("/admin/invoices/{invoiceApplyId}/reject")
    public Map<String, Object> rejectInvoice(@PathVariable Long invoiceApplyId, @RequestBody Map<String, Object> request) {
        String reason = requiredString(request, "reason");
        jdbcClient.sql("UPDATE invoice_applies SET invoice_status = 'REJECTED', reject_reason = :reason WHERE id = :id")
            .param("reason", reason)
            .param("id", invoiceApplyId)
            .update();
        log("开票管理", "驳回开票", String.valueOf(invoiceApplyId), "驳回开票申请");
        return one("SELECT * FROM invoice_applies WHERE id = :id", "id", invoiceApplyId);
    }

    @GetMapping("/mall/invoice-titles")
    public List<Map<String, Object>> invoiceTitles() {
        return rows("""
            SELECT id, buyer_name, title_type, invoice_title AS title, tax_no, receive_email, is_default, created_at, updated_at
            FROM invoice_titles
            ORDER BY is_default DESC, id
            """);
    }

    @PostMapping("/mall/invoice-titles")
    public Map<String, Object> createInvoiceTitle(@RequestBody Map<String, Object> request) {
        String invoiceTitle = requiredString(request, request.containsKey("title") ? "title" : "invoiceTitle");
        String email = requiredEmail(request, request.containsKey("email") ? "email" : "receiveEmail");
        String titleType = string(request.getOrDefault("titleType", "COMPANY"));
        String taxNo = string(request.getOrDefault("taxNo", ""));
        if ("COMPANY".equalsIgnoreCase(titleType) && taxNo.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "taxNo is required for company invoice title");
        }
        jdbcClient.sql("""
            INSERT INTO invoice_titles (buyer_name, title_type, invoice_title, tax_no, receive_email, is_default)
            VALUES (:buyerName, :titleType, :invoiceTitle, :taxNo, :email, false)
            """)
            .param("buyerName", string(request.getOrDefault("buyerName", "杭州采购王")))
            .param("titleType", titleType)
            .param("invoiceTitle", invoiceTitle)
            .param("taxNo", taxNo)
            .param("email", email)
            .update();
        return rows("SELECT * FROM invoice_titles ORDER BY id DESC").get(0);
    }

    @GetMapping("/system/parameters")
    public Map<String, Object> systemParameters() {
        Map<String, Object> result = new LinkedHashMap<>();
        rows("SELECT param_key, param_value FROM system_parameters").forEach(item -> result.put(String.valueOf(item.get("paramKey")), item.get("paramValue")));
        return result;
    }

    @GetMapping("/admin/operation-logs")
    public List<Map<String, Object>> operationLogs() {
        return rows("""
            SELECT id, log_no, operator_name, module_name, operation_name, related_no, operation_content, operation_result, created_at
            FROM operation_logs
            ORDER BY id DESC
            """);
    }

    private Long firstProductId() {
        return productRepository.findAll().stream().findFirst().map(Product::id).orElse(1L);
    }

    private int soldQty(Long productId) {
        return jdbcClient.sql("SELECT COALESCE(SUM(quantity), 0) FROM sales_order_items WHERE product_id = :productId")
            .param("productId", productId)
            .query(Integer.class)
            .single();
    }

    private int stockWarningThreshold() {
        return Integer.parseInt(String.valueOf(systemParameters().getOrDefault("stockWarningThreshold", "50")));
    }

    private long count(String sql) {
        return jdbcClient.sql(sql).query(Long.class).single();
    }

    private String requiredString(Map<String, Object> request, String field) {
        String value = string(request.get(field)).trim();
        if (value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        return value;
    }

    private String requiredEmail(Map<String, Object> request, String field) {
        String value = requiredString(request, field);
        if (!value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be a valid email");
        }
        return value;
    }

    private Long requiredLong(Map<String, Object> request, String field) {
        if (!request.containsKey(field) || request.get(field) == null || string(request.get(field)).isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        try {
            return number(request.get(field)).longValue();
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be a number");
        }
    }

    private int requiredInt(Map<String, Object> request, String field) {
        if (!request.containsKey(field) || request.get(field) == null || string(request.get(field)).isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        try {
            return number(request.get(field)).intValue();
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be a number");
        }
    }

    private int positiveInt(Map<String, Object> request, String field) {
        int value = requiredInt(request, field);
        if (value <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be greater than zero");
        }
        return value;
    }

    private BigDecimal positiveMoney(Map<String, Object> request, String field) {
        BigDecimal value = moneyValue(request, field);
        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be greater than zero");
        }
        return value;
    }

    private BigDecimal nonNegativeMoney(Map<String, Object> request, String field) {
        BigDecimal value = moneyValue(request, field);
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " cannot be negative");
        }
        return value;
    }

    private BigDecimal moneyValue(Map<String, Object> request, String field) {
        if (!request.containsKey(field) || request.get(field) == null || string(request.get(field)).isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        try {
            return new BigDecimal(String.valueOf(request.get(field)));
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be a valid amount");
        }
    }

    private Number number(Object value) {
        if (value instanceof Number number) {
            return number;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String normalizeStatus(Object value) {
        String status = string(value).trim().toUpperCase();
        if ("启用".equals(value) || "ON".equals(status)) {
            return "ENABLED";
        }
        if ("禁用".equals(value) || "停用".equals(value) || "OFF".equals(status)) {
            return "DISABLED";
        }
        return status;
    }

    private List<Map<String, Object>> rows(String sql) {
        return jdbcClient.sql(sql).query(this::mapRow).list();
    }

    private Map<String, Object> one(String sql, String paramName, Object value) {
        return jdbcClient.sql(sql)
            .param(paramName, value)
            .query(this::mapRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Data not found"));
    }

    private void log(String module, String operation, String relatedNo, String content) {
        String logNo = "LOG" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO operation_logs (log_no, operator_name, module_name, operation_name, related_no, operation_content, operation_result)
            VALUES (:logNo, '系统', :module, :operation, :relatedNo, :content, 'SUCCESS')
            """)
            .param("logNo", logNo)
            .param("module", module)
            .param("operation", operation)
            .param("relatedNo", relatedNo)
            .param("content", content)
            .update();
    }

    private Map<String, Object> mapRow(ResultSet rs, int rowNum) throws SQLException {
        ResultSetMetaData metaData = rs.getMetaData();
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 1; i <= metaData.getColumnCount(); i++) {
            result.put(toCamelCase(metaData.getColumnLabel(i)), rs.getObject(i));
        }
        return result;
    }

    private String toCamelCase(String value) {
        StringBuilder builder = new StringBuilder();
        boolean upperNext = false;
        for (char ch : value.toCharArray()) {
            if (ch == '_') {
                upperNext = true;
            } else if (upperNext) {
                builder.append(Character.toUpperCase(ch));
                upperNext = false;
            } else {
                builder.append(Character.toLowerCase(ch));
            }
        }
        return builder.toString();
    }

    private Map<String, Object> row(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }
}
