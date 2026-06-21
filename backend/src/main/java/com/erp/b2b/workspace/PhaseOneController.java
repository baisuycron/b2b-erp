package com.erp.b2b.workspace;

import com.erp.b2b.auth.AuthTokenService;
import com.erp.b2b.common.ApiException;
import com.erp.b2b.inventory.InventoryRepository;
import com.erp.b2b.order.OrderService;
import com.erp.b2b.product.CreateProductRequest;
import com.erp.b2b.product.MallProductListItem;
import com.erp.b2b.product.Product;
import com.erp.b2b.product.ProductListItem;
import com.erp.b2b.product.ProductRepository;
import com.erp.b2b.product.ProductThumbnailService;
import com.erp.b2b.product.ProductImageUrlService;
import com.erp.b2b.product.search.ImageSearchService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PhaseOneController {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JdbcClient jdbcClient;
    private final ProductRepository productRepository;
    private final ProductThumbnailService productThumbnailService;
    private final ProductImageUrlService productImageUrlService;
    private final ImageSearchService imageSearchService;
    private final InventoryRepository inventoryRepository;
    private final OrderService orderService;
    private final AuthTokenService authTokenService;
    private final List<Map<String, Object>> buyerCartItems = new ArrayList<>();
    private final List<Map<String, Object>> buyerAddresses = new ArrayList<>();
    private final AtomicLong cartItemSequence = new AtomicLong(1000);
    private final AtomicLong addressSequence = new AtomicLong(1000);
    private static final String SUPER_ADMIN_ROLE = "超级管理员";
    private static final String DASHBOARD_PERMISSION_KEY = "dashboard";

    public PhaseOneController(JdbcClient jdbcClient, ProductRepository productRepository, ProductThumbnailService productThumbnailService, ProductImageUrlService productImageUrlService, ImageSearchService imageSearchService, InventoryRepository inventoryRepository, OrderService orderService, AuthTokenService authTokenService) {
        this.jdbcClient = jdbcClient;
        this.productRepository = productRepository;
        this.productThumbnailService = productThumbnailService;
        this.productImageUrlService = productImageUrlService;
        this.imageSearchService = imageSearchService;
        this.inventoryRepository = inventoryRepository;
        this.orderService = orderService;
        this.authTokenService = authTokenService;
        buyerAddresses.add(row("id", addressSequence.incrementAndGet(), "receiverName", "李经理", "receiverPhone", "13888888888", "region", "浙江省 杭州市 西湖区", "detailAddress", "文三路188号3号楼1201室", "isDefault", true));
        buyerAddresses.add(row("id", addressSequence.incrementAndGet(), "receiverName", "王采购", "receiverPhone", "13666666666", "region", "浙江省 杭州市 余杭区", "detailAddress", "未来科技城88号", "isDefault", false));
    }

    @GetMapping("/admin/summary")
    public Map<String, Object> adminSummary() {
        var products = productRepository.findAll();
        var orders = orderService.listOrders();
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        long todayOrders = orders.stream()
            .filter(order -> order.createdAt() != null && !order.createdAt().isBefore(todayStart))
            .count();
        BigDecimal todayPaymentAmount = orders.stream()
            .filter(order -> "PAID".equals(order.paymentStatus()))
            .filter(order -> order.updatedAt() != null && !order.updatedAt().isBefore(todayStart))
            .map(order -> order.totalAmount() == null ? BigDecimal.ZERO : order.totalAmount())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal todayRefundAmount = jdbcClient.sql("""
            SELECT COALESCE(SUM(refund_amount), 0)
            FROM after_sale_orders
            WHERE refund_status = 'SUCCESS'
              AND updated_at >= :todayStart
            """)
            .param("todayStart", todayStart)
            .query(BigDecimal.class)
            .single();
        long todayNewBuyers = count("""
            SELECT COUNT(*)
            FROM customers
            WHERE created_at >= :todayStart
            """, "todayStart", todayStart);
        long pendingAfterSale = count("SELECT COUNT(*) FROM after_sale_orders WHERE after_sale_status NOT IN ('COMPLETED','REJECTED')");
        long pendingInvoice = count("SELECT COUNT(*) FROM invoice_applies WHERE invoice_status = 'WAIT_INVOICE'");
        return row(
            "todayOrders", todayOrders,
            "todayOrderCount", todayOrders,
            "todayPaymentAmount", todayPaymentAmount,
            "todayRefundAmount", todayRefundAmount == null ? BigDecimal.ZERO : todayRefundAmount,
            "todayNewBuyers", todayNewBuyers,
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
        String login = string(request.getOrDefault("phone",
            request.getOrDefault("username", request.getOrDefault("accountName", "")))).trim();
        String password = string(request.get("password")).trim();
        if (login.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请输入账号或手机号");
        }
        if (password.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请输入密码");
        }
        if (password.length() < 6 || password.length() > 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "密码长度需为6-20位");
        }
        Map<String, Object> account = jdbcClient.sql("""
            SELECT account_name AS username, account_name, real_name, phone, role_name, account_status, password_hash
            FROM admin_accounts
            WHERE phone = :login OR account_name = :login
            """)
            .param("login", login)
            .query(this::mapRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "账号或手机号或密码错误"));
        if (!passwordHash(password).equals(account.get("passwordHash"))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "账号或手机号或密码错误");
        }
        if (!"ENABLED".equals(account.get("accountStatus"))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "当前账号已被禁用，请联系管理员");
        }
        String username = string(account.get("username"));
        String realName = string(account.get("realName"));
        List<String> roleNames = roleNames(account.get("roleName"));
        boolean isSuperAdmin = roleNames.contains(SUPER_ADMIN_ROLE);
        AuthTokenService.IssuedToken token = authTokenService.issue("ADMIN", username);
        return row(
            "token", token.value(),
            "expiresAt", token.expiresAt().toString(),
            "expiresInSeconds", token.expiresInSeconds(),
            "username", username,
            "accountName", realName,
            "realName", realName,
            "phone", account.get("phone"),
            "role", account.get("roleName"),
            "roleNames", roleNames,
            "isSuperAdmin", isSuperAdmin,
            "permissionKeys", isSuperAdmin ? allPermissionKeys() : rolePermissionKeys(roleNames)
        );
    }

    @GetMapping("/admin/accounts")
    public List<Map<String, Object>> adminAccounts() {
        List<Map<String, Object>> rows = rows("""
            SELECT id, account_name AS username, real_name, phone, role_name, account_status AS status, created_at, updated_at
            FROM admin_accounts
            ORDER BY id
            """);
        rows.forEach(item -> item.put("roleNames", roleNames(item.get("roleName"))));
        return rows;
    }

    @PostMapping("/admin/accounts")
    public Map<String, Object> createAdminAccount(@RequestBody Map<String, Object> request) {
        String accountName = requiredString(request, "username", "accountName");
        String realName = requiredString(request, "realName", "accountName");
        String phone = requiredString(request, "phone");
        String password = requiredPassword(request);
        String roleName = requireEnabledRoles(request);
        ensureUniqueAdminAccount(accountName, phone, null);
        jdbcClient.sql("""
            INSERT INTO admin_accounts (account_name, real_name, phone, password_hash, role_name, account_status)
            VALUES (:accountName, :realName, :phone, :passwordHash, :roleName, 'ENABLED')
            """)
            .param("accountName", accountName)
            .param("realName", realName)
            .param("phone", phone)
            .param("passwordHash", passwordHash(password))
            .param("roleName", roleName)
            .update();
        log("系统管理", "新增后台账号", accountName, "新增账号 " + accountName);
        refreshRoleAccountCounts();
        return one("SELECT * FROM admin_accounts WHERE account_name = :accountName", "accountName", accountName);
    }

    @PutMapping("/admin/accounts/{accountId}")
    public Map<String, Object> updateAdminAccount(@PathVariable Long accountId, @RequestBody Map<String, Object> request) {
        String accountName = requiredString(request, "username", "accountName");
        String realName = requiredString(request, "realName", "accountName");
        String phone = requiredString(request, "phone");
        String roleName = requireEnabledRoles(request);
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        ensureUniqueAdminAccount(accountName, phone, accountId);
        jdbcClient.sql("""
            UPDATE admin_accounts
            SET account_name = :accountName, real_name = :realName, phone = :phone, role_name = :roleName, account_status = :status
            WHERE id = :id
            """)
            .param("accountName", accountName)
            .param("realName", realName)
            .param("phone", phone)
            .param("roleName", roleName)
            .param("status", status)
            .param("id", accountId)
            .update();
        log("系统管理", "编辑后台账号", String.valueOf(accountId), "编辑后台账号资料");
        refreshRoleAccountCounts();
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
        refreshRoleAccountCounts();
        return one("SELECT * FROM admin_accounts WHERE id = :id", "id", accountId);
    }

    @PostMapping("/admin/accounts/{accountId}/password/reset")
    public Map<String, Object> resetAdminAccountPassword(@PathVariable Long accountId, @RequestBody Map<String, Object> request) {
        Map<String, Object> account = one("SELECT * FROM admin_accounts WHERE id = :id", "id", accountId);
        String password = requiredPassword(request);
        jdbcClient.sql("UPDATE admin_accounts SET password_hash = :passwordHash WHERE id = :id")
            .param("passwordHash", passwordHash(password))
            .param("id", accountId)
            .update();
        log("系统管理", "重置后台账号密码", String.valueOf(accountId), "重置账号 " + account.get("accountName") + " 密码");
        return row("reset", true, "accountId", accountId);
    }

    @GetMapping("/admin/roles")
    public List<Map<String, Object>> adminRoles() {
        return rows("""
            SELECT id, role_name, role_desc AS description, account_count, role_status AS status, permission_json, created_at, updated_at
            FROM admin_roles
            ORDER BY id
            """);
    }

    @PostMapping("/admin/roles")
    public Map<String, Object> createRole(@RequestBody Map<String, Object> request) {
        String roleName = requiredString(request, "roleName");
        String roleDesc = optionalString(request, "roleDesc", "description");
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        String permissionJson = permissionJson(request);
        jdbcClient.sql("""
            INSERT INTO admin_roles (role_name, role_desc, account_count, role_status, permission_json)
            VALUES (:roleName, :roleDesc, 0, :status, :permissionJson)
            """)
            .param("roleName", roleName)
            .param("roleDesc", roleDesc)
            .param("status", status)
            .param("permissionJson", permissionJson)
            .update();
        log("系统管理", "新增角色", roleName, "新增角色 " + roleName);
        return one("SELECT * FROM admin_roles WHERE role_name = :roleName", "roleName", roleName);
    }

    @PutMapping("/admin/roles/{roleId}")
    public Map<String, Object> updateRole(@PathVariable Long roleId, @RequestBody Map<String, Object> request) {
        String roleName = requiredString(request, "roleName");
        String roleDesc = optionalString(request, "roleDesc", "description");
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        String permissionJson = permissionJson(request);
        jdbcClient.sql("""
            UPDATE admin_roles
            SET role_name = :roleName, role_desc = :roleDesc, role_status = :status, permission_json = :permissionJson
            WHERE id = :id
            """)
            .param("roleName", roleName)
            .param("roleDesc", roleDesc)
            .param("status", status)
            .param("permissionJson", permissionJson)
            .param("id", roleId)
            .update();
        log("系统管理", "编辑角色", String.valueOf(roleId), "编辑角色资料");
        return one("SELECT * FROM admin_roles WHERE id = :id", "id", roleId);
    }

    @DeleteMapping("/admin/roles/{roleId}")
    public Map<String, Object> deleteRole(@PathVariable Long roleId) {
        Map<String, Object> role = one("SELECT * FROM admin_roles WHERE id = :id", "id", roleId);
        String roleName = string(role.get("roleName"));
        if (SUPER_ADMIN_ROLE.equals(roleName)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "超级管理员角色不允许删除");
        }
        Long accountCount = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM admin_accounts
            WHERE FIND_IN_SET(:roleName, REPLACE(role_name, '、', ',')) > 0
            """)
            .param("roleName", roleName)
            .query(Long.class)
            .single();
        if (accountCount != null && accountCount > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "当前角色已关联账号，不能删除");
        }
        jdbcClient.sql("DELETE FROM admin_roles WHERE id = :id")
            .param("id", roleId)
            .update();
        log("系统管理", "删除角色", roleName, "删除角色 " + roleName);
        refreshRoleAccountCounts();
        return row("deleted", true, "id", roleId);
    }

    @GetMapping("/admin/permissions/tree")
    public List<Map<String, Object>> permissionTree() {
        return List.of(
            permissionModule(DASHBOARD_PERMISSION_KEY, "首页工作台", List.of()),
            permissionModule("goods", "商品管理", List.of(row("key", "goods:product-list", "title", "商品档案"), row("key", "goods:product-category", "title", "商品分类"), row("key", "goods:product-brand", "title", "商品品牌"), row("key", "goods:product-attribute-template", "title", "商品属性模板"))),
            permissionModule("purchase", "采购管理", List.of(row("key", "purchase:supplier", "title", "供应商管理"), row("key", "purchase:purchase-order", "title", "采购订单"), row("key", "purchase:purchase-inbound", "title", "采购入库记录"))),
            permissionModule("stock", "库存管理", List.of(row("key", "stock:stock-overview", "title", "库存总览"), row("key", "stock:stock-flow", "title", "库存流水"))),
            permissionModule("order", "订单管理", List.of()),
            permissionModule("aftersale", "售后管理", List.of()),
            permissionModule("invoice", "开票管理", List.of()),
            permissionModule("buyer", "买家管理", List.of()),
            permissionModule("finance", "财务管理", List.of(row("key", "finance:finance-payment", "title", "支付记录"), row("key", "finance:finance-refund", "title", "退款记录"))),
            permissionModule("system", "系统管理", List.of(row("key", "system:system-user", "title", "后台账号"), row("key", "system:system-role", "title", "角色权限"), row("key", "system:system-log", "title", "操作日志"), row("key", "system:system-config", "title", "基础配置")))
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

    @GetMapping("/mall/product-categories")
    public List<Map<String, Object>> mallProductCategories() {
        return rows("""
            SELECT id, category_name, parent_name, sort_no, category_status AS status
            FROM product_categories
            WHERE category_status = 'ENABLED'
            ORDER BY sort_no, id
            """);
    }

    @DeleteMapping("/admin/product-categories/{categoryId}")
    public Map<String, Object> deleteProductCategory(@PathVariable Long categoryId) {
        Map<String, Object> current = one("SELECT * FROM product_categories WHERE id = :id", "id", categoryId);
        jdbcClient.sql("DELETE FROM product_categories WHERE id = :id")
            .param("id", categoryId)
            .update();
        log("商品管理", "删除商品分类", String.valueOf(categoryId), "删除商品分类 " + current.get("categoryName"));
        return row("deleted", true, "id", categoryId);
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

    @DeleteMapping("/admin/product-brands/{brandId}")
    public Map<String, Object> deleteProductBrand(@PathVariable Long brandId) {
        Map<String, Object> current = one("SELECT * FROM product_brands WHERE id = :id", "id", brandId);
        jdbcClient.sql("DELETE FROM product_brands WHERE id = :id")
            .param("id", brandId)
            .update();
        log("商品管理", "删除商品品牌", String.valueOf(brandId), "删除商品品牌 " + current.get("brandName"));
        return row("deleted", true, "id", brandId);
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

    @GetMapping("/admin/product-attribute-templates")
    public List<Map<String, Object>> productAttributeTemplates() {
        List<Map<String, Object>> templates = rows("""
            SELECT t.id, t.template_name, t.fields_json,
                   (SELECT COUNT(*) FROM products p WHERE p.attribute_template_id = t.id) AS product_count,
                   t.created_at, t.updated_at
            FROM product_attribute_templates t
            ORDER BY t.id DESC
            """);
        templates.forEach(this::expandAttributeTemplateFields);
        return templates;
    }

    @PostMapping("/admin/product-attribute-templates")
    public Map<String, Object> createProductAttributeTemplate(@RequestBody Map<String, Object> request) {
        String templateName = requiredString(request, "templateName");
        String fieldsJson = attributeFieldsJson(request);
        jdbcClient.sql("INSERT INTO product_attribute_templates (template_name, fields_json) VALUES (:templateName, :fieldsJson)")
            .param("templateName", templateName)
            .param("fieldsJson", fieldsJson)
            .update();
        log("商品管理", "新增商品属性模板", templateName, "新增商品属性模板");
        return productAttributeTemplateByName(templateName);
    }

    @PutMapping("/admin/product-attribute-templates/{templateId}")
    public Map<String, Object> updateProductAttributeTemplate(@PathVariable Long templateId, @RequestBody Map<String, Object> request) {
        one("SELECT id FROM product_attribute_templates WHERE id = :id", "id", templateId);
        String templateName = requiredString(request, "templateName");
        String fieldsJson = attributeFieldsJson(request);
        jdbcClient.sql("UPDATE product_attribute_templates SET template_name = :templateName, fields_json = :fieldsJson WHERE id = :id")
            .param("templateName", templateName)
            .param("fieldsJson", fieldsJson)
            .param("id", templateId)
            .update();
        log("商品管理", "编辑商品属性模板", String.valueOf(templateId), "编辑商品属性模板");
        return productAttributeTemplateById(templateId);
    }

    @DeleteMapping("/admin/product-attribute-templates/{templateId}")
    public Map<String, Object> deleteProductAttributeTemplate(@PathVariable Long templateId) {
        Map<String, Object> current = one("SELECT id, template_name FROM product_attribute_templates WHERE id = :id", "id", templateId);
        Integer productCount = jdbcClient.sql("SELECT COUNT(*) FROM products WHERE attribute_template_id = :id")
            .param("id", templateId)
            .query(Integer.class)
            .single();
        if (productCount != null && productCount > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "该模板已关联商品，无法删除");
        }
        jdbcClient.sql("DELETE FROM product_attribute_templates WHERE id = :id")
            .param("id", templateId)
            .update();
        log("商品管理", "删除商品属性模板", String.valueOf(templateId), "删除商品属性模板 " + current.get("templateName"));
        return row("deleted", true, "id", templateId);
    }

    @GetMapping("/admin/products")
    public List<ProductListItem> adminProducts() {
        return productRepository.findAdminList();
    }

    @GetMapping("/admin/products/{productId}")
    public Map<String, Object> adminProductDetail(@PathVariable Long productId) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        String thumbnailUrl = productRepository.findMainImageThumbnailUrl(productId);
        return productImageUrlService.toDetailResponse(product, thumbnailUrl);
    }

    @PostMapping("/admin/products")
    public Product createAdminProduct(@Valid @RequestBody CreateProductRequest request) {
        Product product = productRepository.create(request);
        productThumbnailService.refreshAndStore(product);
        imageSearchService.syncProductImages(product);
        log("商品管理", "新增商品", product.productCode(), "新增商品 " + product.productName());
        return product;
    }

    @PutMapping("/admin/products/{productId}")
    public Product updateAdminProduct(@PathVariable Long productId, @Valid @RequestBody CreateProductRequest request) {
        Product product = productRepository.update(productId, request);
        productThumbnailService.refreshAndStore(product);
        imageSearchService.syncProductImages(product);
        log("商品管理", "编辑商品", product.productCode(), "编辑商品 " + product.productName());
        return product;
    }

    @PutMapping("/admin/products/batch-update")
    @Transactional
    public Map<String, Object> batchUpdateProducts(@RequestBody Map<String, Object> request) {
        List<Long> productIds = requiredProductIds(request);
        String type = requiredString(request, "type");
        int updatedCount = switch (type) {
            case "category" -> productRepository.batchUpdateCategory(productIds, requiredString(request, "categoryName"));
            case "brand" -> productRepository.batchUpdateBrand(productIds, requiredString(request, "brandName"));
            case "status" -> productRepository.batchUpdateSaleStatus(productIds, requiredString(request, "saleStatus"));
            case "attributes" -> productRepository.batchUpdateAttributes(
                productIds,
                requiredLong(request, "attributeTemplateId"),
                mapRows(request.get("customAttributes"))
            );
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "不支持的批量修改类型");
        };
        log("商品管理", "批量修改商品", String.join(",", productIds.stream().map(String::valueOf).toList()), "批量修改商品" + updatedCount + "条");
        return row("updated", updatedCount, "productIds", productIds);
    }

    @PostMapping("/admin/products/batch-delete/check")
    public Map<String, Object> checkProductsBeforeBatchDelete(@RequestBody Map<String, Object> request) {
        List<Long> productIds = requiredProductIds(request);
        List<Map<String, Object>> blocked = new ArrayList<>();
        List<Map<String, Object>> deletable = new ArrayList<>();

        for (Long productId : productIds) {
            Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "商品不存在或已被删除"));
            boolean hasInboundRecord = count("SELECT COUNT(*) FROM inventory_movements WHERE product_id = :productId AND quantity_delta > 0", "productId", productId) > 0;
            boolean hasSalesRecord = count("SELECT COUNT(*) FROM sales_order_items WHERE product_id = :productId", "productId", productId) > 0;
            List<String> recordTypes = new ArrayList<>();
            if (hasInboundRecord) recordTypes.add("入库记录");
            if (hasSalesRecord) recordTypes.add("销售记录");

            Map<String, Object> result = row(
                "id", product.id(),
                "productCode", product.productCode(),
                "productName", product.productName(),
                "hasInboundRecord", hasInboundRecord,
                "hasSalesRecord", hasSalesRecord,
                "reason", recordTypes.isEmpty() ? "可删除" : String.join("、", recordTypes) + "，无法删除"
            );
            (recordTypes.isEmpty() ? deletable : blocked).add(result);
        }

        return row(
            "selectedCount", productIds.size(),
            "deletable", deletable,
            "blocked", blocked
        );
    }

    @PostMapping("/admin/products/batch-delete")
    @Transactional
    public Map<String, Object> batchDeleteProducts(@RequestBody Map<String, Object> request) {
        List<Long> productIds = requiredProductIds(request);
        for (Long productId : productIds) {
            jdbcClient.sql("SELECT id FROM products WHERE id = :productId FOR UPDATE")
                .param("productId", productId)
                .query(Long.class)
                .optional()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "商品不存在或已被删除"));
        }
        Map<String, Object> checkResult = checkProductsBeforeBatchDelete(request);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> blocked = (List<Map<String, Object>>) checkResult.get("blocked");
        if (!blocked.isEmpty()) {
            return row("deletedCount", 0, "blocked", blocked);
        }

        int deletedCount = 0;
        for (Long productId : productIds) {
            Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "商品不存在或已被删除"));
            jdbcClient.sql("DELETE FROM product_image_vectors WHERE product_id = :productId")
                .param("productId", productId)
                .update();
            deletedCount += jdbcClient.sql("DELETE FROM products WHERE id = :productId")
                .param("productId", productId)
                .update();
            log("商品管理", "批量删除商品", product.productCode(), "删除商品 " + product.productName());
        }
        return row("deletedCount", deletedCount, "blocked", List.of());
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
    public List<MallProductListItem> mallProducts(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Long categoryId,
        @RequestParam(required = false) String categoryName,
        @RequestParam(required = false) Long brandId,
        @RequestParam(required = false) String brandName
    ) {
        return productRepository.findMallProductList(keyword, categoryId, categoryName, brandId, brandName);
    }

    @GetMapping("/mall/products/{productId}")
    public Map<String, Object> mallProductDetail(@PathVariable Long productId) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        String thumbnailUrl = productRepository.findMainImageThumbnailUrl(productId);
        return productImageUrlService.toDetailResponse(product, thumbnailUrl);
    }

    @PostMapping("/buyer/register")
    public Map<String, Object> buyerRegister(@RequestBody Map<String, Object> request) {
        String phone = string(request.getOrDefault("phone", request.get("account"))).trim();
        if (phone.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "\u8bf7\u8f93\u5165\u624b\u673a\u53f7");
        }
        if (customerPhoneExists(phone)) {
            throw new ApiException(HttpStatus.CONFLICT, "\u5f53\u524d\u624b\u673a\u53f7\u5df2\u88ab\u6ce8\u518c");
        }
        return row("buyerNo", "B" + System.currentTimeMillis() % 1000000, "phone", phone, "status", "ENABLED", "auditRequired", false);
    }

    @PostMapping("/buyer/login")
    public Map<String, Object> buyerLogin(@RequestBody Map<String, Object> request) {
        String phone = string(request.getOrDefault("phone", request.get("account"))).trim();
        if (phone.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "\u8bf7\u8f93\u5165\u624b\u673a\u53f7");
        }
        Map<String, Object> customer = jdbcClient.sql("""
            SELECT id, company_name, contact_name, contact_phone, audit_status
            FROM customers
            WHERE contact_phone = :phone
            ORDER BY id DESC
            LIMIT 1
            """)
            .param("phone", phone)
            .query(this::mapRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "\u624b\u673a\u53f7\u6216\u5bc6\u7801\u9519\u8bef"));
        if ("DISABLED".equals(customer.get("auditStatus"))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "\u5f53\u524d\u8d26\u53f7\u5df2\u88ab\u505c\u7528\uff0c\u8bf7\u8054\u7cfb\u5546\u5bb6");
        }
        AuthTokenService.IssuedToken token = authTokenService.issue("BUYER", string(customer.get("id")));
        return row(
            "token", token.value(),
            "expiresAt", token.expiresAt().toString(),
            "expiresInSeconds", token.expiresInSeconds(),
            "phone", customer.get("contactPhone"),
            "buyerName", customer.get("contactName"),
            "companyName", customer.get("companyName"),
            "status", "ENABLED"
        );
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
        List<Map<String, Object>> items = cartItemRows();
        BigDecimal checkedAmount = items.stream()
            .filter(item -> Boolean.parseBoolean(String.valueOf(item.getOrDefault("checked", true))))
            .map(item -> new BigDecimal(String.valueOf(item.get("salePrice"))).multiply(BigDecimal.valueOf(Long.parseLong(String.valueOf(item.get("quantity"))))))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return row("checkedAmount", checkedAmount, "items", items);
    }

    @PostMapping("/mall/cart/items")
    public Map<String, Object> addCartItem(@RequestBody Map<String, Object> request) {
        Long productId = requiredLong(request, "productId");
        int quantity = positiveInt(request, "quantity");
        int specIndex = request.containsKey("specIndex") ? nonNegativeInt(request, "specIndex") : 0;
        Product product = productRepository.findById(productId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        if (!"ON_SALE".equals(product.saleStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Product is not on sale");
        }
        Map<String, Object> item = buyerCartItems.stream()
            .filter(row -> productId.equals(Long.parseLong(String.valueOf(row.get("productId")))) && specIndex == intValue(row.get("specIndex"), 0))
            .findFirst()
            .orElse(null);
        int nextQuantity = quantity;
        if (item == null) {
            item = row("cartItemId", cartItemSequence.incrementAndGet(), "productId", productId, "specIndex", specIndex, "quantity", 0, "checked", true);
            buyerCartItems.add(item);
        } else {
            nextQuantity += Integer.parseInt(String.valueOf(item.get("quantity")));
        }
        if (nextQuantity > skuStockQuantity(product, specIndex)) {
            throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock");
        }
        item.put("quantity", nextQuantity);
        item.put("checked", true);
        return cartItemRow(item);
    }

    @GetMapping("/mall/cart/count")
    public Map<String, Object> mallCartCount() {
        int count = buyerCartItems.stream()
            .mapToInt(item -> Integer.parseInt(String.valueOf(item.getOrDefault("quantity", 0))))
            .sum();
        return row("count", count);
    }

    @PutMapping("/mall/cart/items/{cartItemId}")
    public Map<String, Object> updateCartItem(@PathVariable Long cartItemId, @RequestBody Map<String, Object> request) {
        Map<String, Object> item = findCartItem(cartItemId);
        if (request.containsKey("quantity")) {
            int quantity = positiveInt(request, "quantity");
            Product product = productRepository.findById(Long.parseLong(String.valueOf(item.get("productId"))))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
            int specIndex = intValue(item.get("specIndex"), 0);
            if (quantity > skuStockQuantity(product, specIndex)) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock");
            }
            item.put("quantity", quantity);
        }
        if (request.containsKey("checked")) {
            item.put("checked", Boolean.parseBoolean(String.valueOf(request.get("checked"))));
        }
        return cartItemRow(item);
    }

    @DeleteMapping("/mall/cart/items/{cartItemId}")
    public Map<String, Object> deleteCartItem(@PathVariable Long cartItemId) {
        buyerCartItems.removeIf(item -> cartItemId.equals(Long.parseLong(String.valueOf(item.get("cartItemId")))));
        return row("deleted", true, "id", cartItemId);
    }

    @DeleteMapping("/mall/cart")
    public Map<String, Object> clearCart() {
        buyerCartItems.clear();
        return row("deleted", true);
    }

    @GetMapping("/mall/addresses")
    public List<Map<String, Object>> mallAddresses() {
        return buyerAddresses.stream().map(this::addressRow).toList();
    }

    @PostMapping("/mall/addresses")
    public Map<String, Object> createAddress(@RequestBody Map<String, Object> request) {
        Map<String, Object> item = row(
            "id", addressSequence.incrementAndGet(),
            "receiverName", requiredString(request, "receiverName"),
            "receiverPhone", requiredString(request, "receiverPhone"),
            "region", requiredString(request, "region"),
            "detailAddress", requiredString(request, "detailAddress"),
            "isDefault", Boolean.parseBoolean(String.valueOf(request.getOrDefault("isDefault", buyerAddresses.isEmpty())))
        );
        if (Boolean.parseBoolean(String.valueOf(item.get("isDefault")))) {
            clearDefaultAddress();
        }
        buyerAddresses.add(item);
        ensureDefaultAddress();
        return addressRow(item);
    }

    @PutMapping("/mall/addresses/{addressId}")
    public Map<String, Object> updateAddress(@PathVariable Long addressId, @RequestBody Map<String, Object> request) {
        Map<String, Object> item = findAddress(addressId);
        item.put("receiverName", requiredString(request, "receiverName"));
        item.put("receiverPhone", requiredString(request, "receiverPhone"));
        item.put("region", requiredString(request, "region"));
        item.put("detailAddress", requiredString(request, "detailAddress"));
        if (Boolean.parseBoolean(String.valueOf(request.getOrDefault("isDefault", false)))) {
            clearDefaultAddress();
            item.put("isDefault", true);
        }
        ensureDefaultAddress();
        return addressRow(item);
    }

    @DeleteMapping("/mall/addresses/{addressId}")
    public Map<String, Object> deleteAddress(@PathVariable Long addressId) {
        buyerAddresses.removeIf(item -> addressId.equals(Long.parseLong(String.valueOf(item.get("id")))));
        ensureDefaultAddress();
        return row("deleted", true, "id", addressId);
    }

    @PutMapping("/mall/addresses/{addressId}/default")
    public Map<String, Object> setDefaultAddress(@PathVariable Long addressId) {
        Map<String, Object> item = findAddress(addressId);
        clearDefaultAddress();
        item.put("isDefault", true);
        return addressRow(item);
    }

    @GetMapping("/admin/suppliers")
    public List<Map<String, Object>> suppliers() {
        return rows("""
            SELECT id, supplier_no, supplier_name, contact_name, contact_phone, address, supplier_status AS status, purchase_count, purchase_amount, created_at, updated_at
            FROM suppliers
            ORDER BY id
            """);
    }

    @GetMapping("/admin/suppliers/{supplierId}")
    public Map<String, Object> supplierDetail(@PathVariable Long supplierId) {
        return one("SELECT * FROM suppliers WHERE id = :id", "id", supplierId);
    }

    @PostMapping("/admin/suppliers")
    @Transactional
    public synchronized Map<String, Object> createSupplier(@RequestBody Map<String, Object> request) {
        String supplierName = requiredString(request, "supplierName");
        String contactName = requiredString(request, "contactName");
        String contactPhone = requiredString(request, "contactPhone");
        int nextSupplierNumber = jdbcClient.sql("""
            SELECT COALESCE(MAX(CAST(supplier_no AS UNSIGNED)), 0) + 1
            FROM suppliers
            WHERE supplier_no REGEXP '^[0-9]{5}$'
            """)
            .query(Integer.class)
            .single();
        if (nextSupplierNumber > 99999) {
            throw new ApiException(HttpStatus.CONFLICT, "供应商编码已达到上限");
        }
        String supplierNo = String.format("%05d", nextSupplierNumber);
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

    @DeleteMapping("/admin/suppliers/{supplierId}")
    public Map<String, Object> deleteSupplier(@PathVariable Long supplierId) {
        Map<String, Object> supplier = one("SELECT * FROM suppliers WHERE id = :id", "id", supplierId);
        int purchaseCount = Integer.parseInt(String.valueOf(supplier.getOrDefault("purchaseCount", 0)));
        if (purchaseCount > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "供应商已发生采购业务，只能停用，不能删除");
        }
        jdbcClient.sql("DELETE FROM suppliers WHERE id = :id")
            .param("id", supplierId)
            .update();
        log("采购管理", "删除供应商", String.valueOf(supplierId), "删除供应商 " + supplier.get("supplierName"));
        return row("deleted", true, "id", supplierId);
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

    @GetMapping("/admin/purchase-orders/{purchaseOrderId}")
    public Map<String, Object> purchaseOrderDetail(@PathVariable Long purchaseOrderId) {
        return one("SELECT * FROM purchase_orders WHERE id = :id", "id", purchaseOrderId);
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
            .param("skuCode", productRepository.primarySkuCode(product))
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
            .param("skuCode", productRepository.primarySkuCode(product))
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
            .param("skuCode", productRepository.primarySkuCode(product))
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
                "skuCode", productRepository.primarySkuCode(product),
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

    @GetMapping("/admin/orders/{orderId}")
    public Object adminOrderDetail(@PathVariable Long orderId) {
        return orderService.getOrder(orderId);
    }

    @PostMapping("/admin/orders/{orderId}/ship")
    @Transactional
    public Object shipAdminOrder(@PathVariable Long orderId, @RequestBody Map<String, Object> request) {
        String shipmentMethod = requiredString(request, "shipmentMethod").trim().toUpperCase();
        if (!List.of("EXPRESS", "NO_LOGISTICS").contains(shipmentMethod)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shipmentMethod must be EXPRESS or NO_LOGISTICS");
        }
        String logisticsCompany = "";
        String logisticsNo = "";
        if ("EXPRESS".equals(shipmentMethod)) {
            logisticsCompany = requiredString(request, "logisticsCompany");
            logisticsNo = requiredString(request, "logisticsNo");
        }
        String operatorName = requiredString(request, "operatorName");
        long operatorExists = jdbcClient.sql("SELECT COUNT(*) FROM admin_accounts WHERE account_name = :accountName")
            .param("accountName", operatorName)
            .query(Long.class)
            .single();
        if (operatorExists == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "operatorName must be an existing admin account");
        }
        String shipmentNo = "FH" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        Object shipped = orderService.ship(orderId, new com.erp.b2b.order.ShipOrderRequest(
            logisticsCompany,
            logisticsNo
        ));
        var order = orderService.getOrder(orderId);
        jdbcClient.sql("""
            INSERT INTO order_shipments (shipment_no, order_id, order_no, shipment_method, logistics_company, logistics_no, operator_name, remark)
            VALUES (:shipmentNo, :orderId, :orderNo, :shipmentMethod, :logisticsCompany, :logisticsNo, :operatorName, :remark)
            """)
            .param("shipmentNo", shipmentNo)
            .param("orderId", orderId)
            .param("orderNo", order.orderNo())
            .param("shipmentMethod", shipmentMethod)
            .param("logisticsCompany", logisticsCompany)
            .param("logisticsNo", logisticsNo)
            .param("operatorName", operatorName)
            .param("remark", string(request.getOrDefault("remark", "")))
            .update();
        log("订单管理", "订单发货", order.orderNo(), "订单发货 " + shipmentNo);
        return shipped;
    }

    @GetMapping("/admin/orders/{orderId}/shipments")
    public List<Map<String, Object>> orderShipments(@PathVariable Long orderId) {
        return rows("""
            SELECT id, shipment_no, order_id, order_no, shipment_method, logistics_company, logistics_no, operator_name, remark, created_at
            FROM order_shipments
            WHERE order_id = :orderId
            ORDER BY id DESC
            """, "orderId", orderId);
    }

    @GetMapping("/mall/orders")
    public Object mallOrders() {
        return orderService.listOrders();
    }

    @GetMapping("/mall/orders/{orderId}")
    public Object mallOrderDetail(@PathVariable Long orderId) {
        return orderService.getOrder(orderId);
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

    @GetMapping("/admin/after-sales/{afterSaleId}")
    public Map<String, Object> afterSaleDetail(@PathVariable Long afterSaleId) {
        Map<String, Object> detail = one("SELECT * FROM after_sale_orders WHERE id = :id", "id", afterSaleId);
        detail.put("returnLogistics", rows("""
            SELECT id, logistics_company, logistics_no, remark, created_at
            FROM after_sale_return_logistics
            WHERE after_sale_id = :id
            ORDER BY id DESC
            """, "id", afterSaleId));
        return detail;
    }

    @GetMapping("/mall/after-sales")
    public List<Map<String, Object>> mallAfterSales() {
        return afterSales();
    }

    @GetMapping("/mall/after-sales/{afterSaleId}")
    public Map<String, Object> mallAfterSaleDetail(@PathVariable Long afterSaleId) {
        return afterSaleDetail(afterSaleId);
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

    @PostMapping("/mall/after-sales/{afterSaleId}/return-logistics")
    public Map<String, Object> submitReturnLogistics(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        jdbcClient.sql("""
            INSERT INTO after_sale_return_logistics (after_sale_id, logistics_company, logistics_no, remark)
            VALUES (:afterSaleId, :logisticsCompany, :logisticsNo, :remark)
            """)
            .param("afterSaleId", afterSaleId)
            .param("logisticsCompany", requiredString(request, "logisticsCompany"))
            .param("logisticsNo", requiredString(request, "logisticsNo"))
            .param("remark", string(request.getOrDefault("remark", "")))
            .update();
        jdbcClient.sql("UPDATE after_sale_orders SET after_sale_status = 'WAIT_RETURN_RECEIVE' WHERE id = :id AND after_sale_status <> 'COMPLETED'")
            .param("id", afterSaleId)
            .update();
        return afterSaleDetail(afterSaleId);
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
    @Transactional
    public Map<String, Object> confirmReturnReceived(@PathVariable Long afterSaleId) {
        Map<String, Object> current = one("SELECT * FROM after_sale_orders WHERE id = :id", "id", afterSaleId);
        if ("RETURN_REFUND".equals(current.get("afterSaleType"))) {
            Long productId = findProductIdByName(String.valueOf(current.getOrDefault("productName", "")));
            if (productId != null) {
                int quantity = Integer.parseInt(String.valueOf(current.getOrDefault("quantity", 1)));
                productRepository.addStock(productId, quantity);
                Product latest = productRepository.findById(productId).orElseThrow();
                inventoryRepository.insertMovement(productId, "RETURN_STOCK_IN", quantity, latest.stockQuantity(), "AFTER_SALE", String.valueOf(current.get("afterSaleNo")), "退货退款确认收货回补库存");
            }
        }
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

    @GetMapping("/admin/invoices/{invoiceApplyId}")
    public Map<String, Object> adminInvoiceDetail(@PathVariable Long invoiceApplyId) {
        Map<String, Object> detail = one("""
            SELECT id, invoice_apply_no, order_no, buyer_name, invoice_type, title_type, invoice_title AS title,
                   apply_amount AS amount, receive_email, invoice_status AS status, invoice_no, reject_reason, created_at, updated_at
            FROM invoice_applies
            WHERE id = :id
            """, "id", invoiceApplyId);
        detail.put("files", invoiceFiles(invoiceApplyId));
        return detail;
    }

    @GetMapping("/mall/invoices")
    public List<Map<String, Object>> mallInvoices() {
        return adminInvoices();
    }

    @GetMapping("/mall/invoices/{invoiceApplyId}")
    public Map<String, Object> mallInvoiceDetail(@PathVariable Long invoiceApplyId) {
        return adminInvoiceDetail(invoiceApplyId);
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
        Map<String, Object> apply = one("SELECT * FROM invoice_applies WHERE id = :id", "id", invoiceApplyId);
        BigDecimal applyAmount = new BigDecimal(String.valueOf(apply.get("applyAmount")));
        BigDecimal fileAmount = invoiceFileAmount(invoiceApplyId);
        if (invoiceFileCount(invoiceApplyId) > 0 && fileAmount.compareTo(applyAmount) != 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "发票文件金额合计必须等于申请开票金额");
        }
        String invoiceNo = "FP" + System.currentTimeMillis() % 100000;
        jdbcClient.sql("UPDATE invoice_applies SET invoice_status = 'INVOICED', invoice_no = :invoiceNo WHERE id = :id")
            .param("invoiceNo", invoiceNo)
            .param("id", invoiceApplyId)
            .update();
        log("开票管理", "确认开票", String.valueOf(invoiceApplyId), "确认开票 " + invoiceNo);
        return one("SELECT * FROM invoice_applies WHERE id = :id", "id", invoiceApplyId);
    }

    @PostMapping("/admin/invoices/{invoiceApplyId}/files")
    public Map<String, Object> uploadInvoiceFile(@PathVariable Long invoiceApplyId, @RequestBody Map<String, Object> request) {
        one("SELECT * FROM invoice_applies WHERE id = :id", "id", invoiceApplyId);
        jdbcClient.sql("""
            INSERT INTO invoice_files (invoice_apply_id, file_name, invoice_no, invoice_type, invoice_amount, ocr_status, ocr_result)
            VALUES (:invoiceApplyId, :fileName, :invoiceNo, :invoiceType, :invoiceAmount, 'WAIT_OCR', :ocrResult)
            """)
            .param("invoiceApplyId", invoiceApplyId)
            .param("fileName", requiredString(request, "fileName"))
            .param("invoiceNo", string(request.getOrDefault("invoiceNo", "")))
            .param("invoiceType", string(request.getOrDefault("invoiceType", "E_NORMAL")))
            .param("invoiceAmount", nonNegativeMoney(request, "invoiceAmount"))
            .param("ocrResult", string(request.getOrDefault("ocrResult", "")))
            .update();
        log("开票管理", "上传发票", String.valueOf(invoiceApplyId), "上传发票文件");
        return adminInvoiceDetail(invoiceApplyId);
    }

    @PostMapping("/admin/invoices/{invoiceApplyId}/ocr")
    public Map<String, Object> ocrInvoice(@PathVariable Long invoiceApplyId, @RequestBody Map<String, Object> request) {
        List<Map<String, Object>> files = invoiceFiles(invoiceApplyId);
        if (files.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请先上传发票文件");
        }
        Long fileId = request.containsKey("fileId") ? requiredLong(request, "fileId") : Long.parseLong(String.valueOf(files.get(0).get("id")));
        Map<String, Object> apply = one("SELECT * FROM invoice_applies WHERE id = :id", "id", invoiceApplyId);
        jdbcClient.sql("""
            UPDATE invoice_files
            SET ocr_status = 'SUCCESS',
                invoice_no = COALESCE(NULLIF(:invoiceNo, ''), invoice_no),
                invoice_type = COALESCE(NULLIF(:invoiceType, ''), invoice_type),
                invoice_amount = :invoiceAmount,
                ocr_result = :ocrResult
            WHERE id = :fileId AND invoice_apply_id = :invoiceApplyId
            """)
            .param("invoiceNo", string(request.getOrDefault("invoiceNo", "OCR" + System.currentTimeMillis() % 100000)))
            .param("invoiceType", string(request.getOrDefault("invoiceType", apply.getOrDefault("invoiceType", "E_NORMAL"))))
            .param("invoiceAmount", request.containsKey("invoiceAmount") ? nonNegativeMoney(request, "invoiceAmount") : new BigDecimal(String.valueOf(apply.get("applyAmount"))))
            .param("ocrResult", string(request.getOrDefault("ocrResult", "OCR识别成功，结果已回填，可人工修改")))
            .param("fileId", fileId)
            .param("invoiceApplyId", invoiceApplyId)
            .update();
        log("开票管理", "OCR识别", String.valueOf(invoiceApplyId), "OCR识别发票文件");
        return adminInvoiceDetail(invoiceApplyId);
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

    @PutMapping("/mall/invoice-titles/{titleId}")
    public Map<String, Object> updateInvoiceTitle(@PathVariable Long titleId, @RequestBody Map<String, Object> request) {
        String invoiceTitle = requiredString(request, request.containsKey("title") ? "title" : "invoiceTitle");
        String email = requiredEmail(request, request.containsKey("email") ? "email" : "receiveEmail");
        String titleType = string(request.getOrDefault("titleType", "COMPANY"));
        String taxNo = string(request.getOrDefault("taxNo", ""));
        if ("COMPANY".equalsIgnoreCase(titleType) && taxNo.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "taxNo is required for company invoice title");
        }
        jdbcClient.sql("""
            UPDATE invoice_titles
            SET title_type = :titleType,
                invoice_title = :invoiceTitle,
                tax_no = :taxNo,
                receive_email = :email
            WHERE id = :id
            """)
            .param("titleType", titleType)
            .param("invoiceTitle", invoiceTitle)
            .param("taxNo", taxNo)
            .param("email", email)
            .param("id", titleId)
            .update();
        return one("SELECT * FROM invoice_titles WHERE id = :id", "id", titleId);
    }

    @DeleteMapping("/mall/invoice-titles/{titleId}")
    public Map<String, Object> deleteInvoiceTitle(@PathVariable Long titleId) {
        Map<String, Object> title = one("SELECT * FROM invoice_titles WHERE id = :id", "id", titleId);
        if (Boolean.parseBoolean(String.valueOf(title.getOrDefault("isDefault", false)))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "默认抬头不能删除，请先设置其他默认抬头");
        }
        jdbcClient.sql("DELETE FROM invoice_titles WHERE id = :id")
            .param("id", titleId)
            .update();
        return row("deleted", true, "id", titleId);
    }

    @PutMapping("/mall/invoice-titles/{titleId}/default")
    public Map<String, Object> setDefaultInvoiceTitle(@PathVariable Long titleId) {
        one("SELECT * FROM invoice_titles WHERE id = :id", "id", titleId);
        jdbcClient.sql("UPDATE invoice_titles SET is_default = false").update();
        jdbcClient.sql("UPDATE invoice_titles SET is_default = true WHERE id = :id")
            .param("id", titleId)
            .update();
        return one("SELECT * FROM invoice_titles WHERE id = :id", "id", titleId);
    }

    @GetMapping("/system/parameters")
    public Map<String, Object> systemParameters() {
        Map<String, Object> result = new LinkedHashMap<>();
        rows("SELECT param_key, param_value FROM system_parameters").forEach(item -> result.put(String.valueOf(item.get("paramKey")), item.get("paramValue")));
        return result;
    }

    @PutMapping("/system/parameters")
    public Map<String, Object> updateSystemParameters(@RequestBody Map<String, Object> request) {
        request.forEach((key, value) -> {
            if (value != null && !string(value).isBlank()) {
                jdbcClient.sql("UPDATE system_parameters SET param_value = :value WHERE param_key = :key")
                    .param("key", key)
                    .param("value", string(value))
                    .update();
            }
        });
        log("系统管理", "修改基础配置", "system_parameters", "修改基础配置");
        return systemParameters();
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

    private List<Long> requiredProductIds(Map<String, Object> request) {
        Object rawIds = request.get("productIds");
        if (!(rawIds instanceof List<?> values) || values.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请至少选择一个商品");
        }
        if (values.size() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "单次最多删除100个商品");
        }
        Set<Long> productIds = new LinkedHashSet<>();
        for (Object value : values) {
            try {
                long productId = Long.parseLong(String.valueOf(value));
                if (productId <= 0) throw new NumberFormatException();
                productIds.add(productId);
            } catch (NumberFormatException exception) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "商品ID格式不正确");
            }
        }
        return List.copyOf(productIds);
    }

    private List<Map<String, Object>> mapRows(Object value) {
        if (!(value instanceof List<?> rows)) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : rows) {
            if (!(item instanceof Map<?, ?> map)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            map.forEach((key, cell) -> row.put(String.valueOf(key), cell));
            result.add(row);
        }
        return result;
    }

    private int stockWarningThreshold() {
        return Integer.parseInt(String.valueOf(systemParameters().getOrDefault("stockWarningThreshold", "50")));
    }

    private long count(String sql) {
        return jdbcClient.sql(sql).query(Long.class).single();
    }

    private long count(String sql, String paramName, Object value) {
        Long result = jdbcClient.sql(sql)
            .param(paramName, value)
            .query(Long.class)
            .single();
        return result == null ? 0 : result;
    }

    private void requireEnabledRole(String roleName) {
        Long exists = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM admin_roles
            WHERE role_name = :roleName AND role_status = 'ENABLED'
            """)
            .param("roleName", roleName)
            .query(Long.class)
            .single();
        if (exists == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "roleName must be an enabled role");
        }
    }

    private String requireEnabledRoles(Map<String, Object> request) {
        List<String> names = roleNames(request.getOrDefault("roleNames", request.get("roleName")));
        if (names.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请选择角色");
        }
        names.forEach(this::requireEnabledRole);
        return String.join(",", names);
    }

    private void ensureUniqueAdminAccount(String accountName, String phone, Long currentId) {
        Long accountCount = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM admin_accounts
            WHERE account_name = :accountName AND (:currentId IS NULL OR id <> :currentId)
            """)
            .param("accountName", accountName)
            .param("currentId", currentId)
            .query(Long.class)
            .single();
        if (accountCount != null && accountCount > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "账号已存在，请更换账号");
        }
        Long phoneCount = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM admin_accounts
            WHERE phone = :phone AND (:currentId IS NULL OR id <> :currentId)
            """)
            .param("phone", phone)
            .param("currentId", currentId)
            .query(Long.class)
            .single();
        if (phoneCount != null && phoneCount > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "手机号已存在，请更换手机号");
        }
    }

    private void refreshRoleAccountCounts() {
        jdbcClient.sql("""
            UPDATE admin_roles r
            SET account_count = (
                SELECT COUNT(*)
                FROM admin_accounts a
                WHERE FIND_IN_SET(r.role_name, REPLACE(a.role_name, '、', ',')) > 0
            )
            """).update();
    }

    private long invoiceFileCount(Long invoiceApplyId) {
        return jdbcClient.sql("SELECT COUNT(*) FROM invoice_files WHERE invoice_apply_id = :invoiceApplyId")
            .param("invoiceApplyId", invoiceApplyId)
            .query(Long.class)
            .single();
    }

    private BigDecimal invoiceFileAmount(Long invoiceApplyId) {
        return jdbcClient.sql("SELECT COALESCE(SUM(invoice_amount), 0) FROM invoice_files WHERE invoice_apply_id = :invoiceApplyId")
            .param("invoiceApplyId", invoiceApplyId)
            .query(BigDecimal.class)
            .single();
    }

    private List<Map<String, Object>> invoiceFiles(Long invoiceApplyId) {
        return rows("""
            SELECT id, invoice_apply_id, file_name, invoice_no, invoice_type, invoice_amount, ocr_status, ocr_result, created_at, updated_at
            FROM invoice_files
            WHERE invoice_apply_id = :invoiceApplyId
            ORDER BY id
            """, "invoiceApplyId", invoiceApplyId);
    }

    private Long findProductIdByName(String productName) {
        return jdbcClient.sql("SELECT id FROM products WHERE product_name = :productName ORDER BY id LIMIT 1")
            .param("productName", productName)
            .query(Long.class)
            .optional()
            .orElse(null);
    }

    private List<Map<String, Object>> cartItemRows() {
        return buyerCartItems.stream()
            .map(this::cartItemRow)
            .toList();
    }

    private Map<String, Object> cartItemRow(Map<String, Object> item) {
        Long productId = Long.parseLong(String.valueOf(item.get("productId")));
        int specIndex = intValue(item.get("specIndex"), 0);
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        Map<String, Object> sku = skuAt(product, specIndex);
        Map<String, Object> productDetail = productImageUrlService.toDetailResponse(product, productRepository.findMainImageThumbnailUrl(productId));
        return row(
            "cartItemId", item.get("cartItemId"),
            "id", product.id(),
            "productId", product.id(),
            "specIndex", specIndex,
            "productName", product.productName(),
            "productCode", product.productCode(),
            "skuCode", skuString(sku, "skuCode", productRepository.primarySkuCode(product)),
            "skuName", skuString(sku, "skuName", product.skuName()),
            "unit", product.unit(),
            "quoteType", product.quoteType(),
            "saleMode", product.saleMode(),
            "saleUnit", product.saleUnit(),
            "saleUnitRatio", product.saleUnitRatio(),
            "mainImageUrl", productDetail.get("mainImageUrl"),
            "mainImageThumbnailUrl", productDetail.get("mainImageThumbnailUrl"),
            "skuListJson", productDetail.get("skuListJson"),
            "quantity", item.get("quantity"),
            "salePrice", skuMoney(sku, "salePrice", product.salePrice()),
            "stockQuantity", skuStockQuantity(product, specIndex),
            "minOrderQuantity", product.minOrderQuantity(),
            "saleStatus", product.saleStatus(),
            "skuStatus", skuString(sku, "skuStatus", product.skuStatus()),
            "checked", Boolean.parseBoolean(String.valueOf(item.getOrDefault("checked", true)))
        );
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> skuRows(Product product) {
        String raw = string(product.skuListJson()).trim();
        if (raw.isBlank()) return List.of();
        try {
            Object parsed = objectMapper.readValue(raw, Object.class);
            if (parsed instanceof List<?> rows) {
                return rows.stream()
                    .filter(Map.class::isInstance)
                    .map(row -> (Map<String, Object>) row)
                    .toList();
            }
        } catch (JsonProcessingException exception) {
            return List.of();
        }
        return List.of();
    }

    private Map<String, Object> skuAt(Product product, int specIndex) {
        List<Map<String, Object>> rows = skuRows(product);
        if (specIndex >= 0 && specIndex < rows.size()) {
            return rows.get(specIndex);
        }
        return Map.of();
    }

    private int skuStockQuantity(Product product, int specIndex) {
        Map<String, Object> sku = skuAt(product, specIndex);
        return intValue(sku.get("stockQuantity"), intValue(product.stockQuantity(), 0));
    }

    private String skuString(Map<String, Object> sku, String field, String fallback) {
        String value = string(sku.get(field)).trim();
        return value.isBlank() ? fallback : value;
    }

    private BigDecimal skuMoney(Map<String, Object> sku, String field, BigDecimal fallback) {
        Object value = sku.get(field);
        if (value == null || string(value).isBlank()) return fallback;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (RuntimeException exception) {
            return fallback;
        }
    }

    private Map<String, Object> findCartItem(Long cartItemId) {
        return buyerCartItems.stream()
            .filter(item -> cartItemId.equals(Long.parseLong(String.valueOf(item.get("cartItemId")))))
            .findFirst()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Cart item not found"));
    }

    private Map<String, Object> addressRow(Map<String, Object> item) {
        String region = string(item.get("region")).trim();
        String detailAddress = string(item.get("detailAddress")).trim();
        String fullAddress = (region + " " + detailAddress).trim();
        return row(
            "id", item.get("id"),
            "receiverName", item.get("receiverName"),
            "receiverPhone", item.get("receiverPhone"),
            "region", region,
            "detailAddress", detailAddress,
            "fullAddress", fullAddress,
            "isDefault", Boolean.parseBoolean(String.valueOf(item.getOrDefault("isDefault", false)))
        );
    }

    private Map<String, Object> findAddress(Long addressId) {
        return buyerAddresses.stream()
            .filter(item -> addressId.equals(Long.parseLong(String.valueOf(item.get("id")))))
            .findFirst()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Address not found"));
    }

    private void clearDefaultAddress() {
        buyerAddresses.forEach(item -> item.put("isDefault", false));
    }

    private void ensureDefaultAddress() {
        if (!buyerAddresses.isEmpty() && buyerAddresses.stream().noneMatch(item -> Boolean.parseBoolean(String.valueOf(item.getOrDefault("isDefault", false))))) {
            buyerAddresses.get(0).put("isDefault", true);
        }
    }

    private String attributeFieldsJson(Map<String, Object> request) {
        Object rawFields = request.getOrDefault("fields", List.of());
        if (!(rawFields instanceof List<?> values) || values.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请至少添加一个属性字段");
        }
        if (values.size() > 10) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "属性字段最多添加10个");
        }
        List<Map<String, Object>> fields = new ArrayList<>();
        Set<String> names = new LinkedHashSet<>();
        for (Object value : values) {
            if (!(value instanceof Map<?, ?> field)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "属性字段格式不正确");
            }
            String name = string(field.get("name")).trim();
            if (name.isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "属性名称不能为空");
            }
            if (name.length() > 30) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "属性名称不能超过30个字符");
            }
            if (!names.add(name)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "属性名称不能重复");
            }
            String id = string(field.get("id")).trim();
            fields.add(row("id", id.isBlank() ? UUID.randomUUID().toString() : id, "name", name));
        }
        try {
            return objectMapper.writeValueAsString(fields);
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "属性字段格式不正确");
        }
    }

    private Map<String, Object> productAttributeTemplateById(Long templateId) {
        List<Map<String, Object>> templates = rows("""
            SELECT t.id, t.template_name, t.fields_json,
                   (SELECT COUNT(*) FROM products p WHERE p.attribute_template_id = t.id) AS product_count,
                   t.created_at, t.updated_at
            FROM product_attribute_templates t
            WHERE t.id = :id
            """, "id", templateId);
        if (templates.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "商品属性模板不存在");
        Map<String, Object> template = templates.get(0);
        expandAttributeTemplateFields(template);
        return template;
    }

    private Map<String, Object> productAttributeTemplateByName(String templateName) {
        List<Map<String, Object>> templates = rows("""
            SELECT t.id, t.template_name, t.fields_json,
                   (SELECT COUNT(*) FROM products p WHERE p.attribute_template_id = t.id) AS product_count,
                   t.created_at, t.updated_at
            FROM product_attribute_templates t
            WHERE t.template_name = :templateName
            """, "templateName", templateName);
        if (templates.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "商品属性模板不存在");
        Map<String, Object> template = templates.get(0);
        expandAttributeTemplateFields(template);
        return template;
    }

    private void expandAttributeTemplateFields(Map<String, Object> template) {
        String raw = string(template.remove("fieldsJson"));
        try {
            Object parsed = objectMapper.readValue(raw, Object.class);
            template.put("fields", parsed instanceof List<?> ? parsed : List.of());
        } catch (JsonProcessingException exception) {
            template.put("fields", List.of());
        }
    }

    private String requiredString(Map<String, Object> request, String field) {
        String value = string(request.get(field)).trim();
        if (value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        return value;
    }

    private String requiredString(Map<String, Object> request, String... fields) {
        for (String field : fields) {
            String value = string(request.get(field)).trim();
            if (!value.isBlank()) {
                return value;
            }
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, String.join("/", fields) + " is required");
    }

    private String optionalString(Map<String, Object> request, String... fields) {
        for (String field : fields) {
            String value = string(request.get(field)).trim();
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String requiredPassword(Map<String, Object> request) {
        String password = string(request.getOrDefault("password", request.get("newPassword"))).trim();
        if (password.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请输入密码");
        }
        if (password.length() < 6 || password.length() > 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "密码长度需为6-20位");
        }
        return password;
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

    private int nonNegativeInt(Map<String, Object> request, String field) {
        int value = requiredInt(request, field);
        if (value < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " cannot be negative");
        }
        return value;
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

    private int intValue(Object value, int fallback) {
        if (value == null || string(value).isBlank()) return fallback;
        try {
            return number(value).intValue();
        } catch (RuntimeException exception) {
            return fallback;
        }
    }

    private String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private boolean customerPhoneExists(String phone) {
        Long count = jdbcClient.sql("SELECT COUNT(*) FROM customers WHERE contact_phone = :phone")
            .param("phone", phone)
            .query(Long.class)
            .single();
        return count != null && count > 0;
    }

    private String passwordHash(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(password.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private String permissionJson(Map<String, Object> request) {
        Object permissions = request.getOrDefault("permissionKeys", request.getOrDefault("permissions", List.of()));
        try {
            return objectMapper.writeValueAsString(permissions);
        } catch (JsonProcessingException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "permissions must be valid JSON");
        }
    }

    private List<String> roleNames(Object value) {
        if (value instanceof List<?> values) {
            return values.stream()
                .map(this::string)
                .map(String::trim)
                .filter(text -> !text.isBlank())
                .distinct()
                .toList();
        }
        return Arrays.stream(string(value).split("[,，、]"))
            .map(String::trim)
            .filter(text -> !text.isBlank())
            .distinct()
            .toList();
    }

    private List<String> rolePermissionKeys(List<String> roleNames) {
        if (roleNames.isEmpty()) {
            return List.of(DASHBOARD_PERMISSION_KEY);
        }
        Set<String> keys = new LinkedHashSet<>();
        keys.add(DASHBOARD_PERMISSION_KEY);
        for (String roleName : roleNames) {
            jdbcClient.sql("SELECT permission_json FROM admin_roles WHERE role_name = :roleName AND role_status = 'ENABLED'")
                .param("roleName", roleName)
                .query(String.class)
                .optional()
                .ifPresent(raw -> keys.addAll(parsePermissionKeys(raw)));
        }
        return new ArrayList<>(keys);
    }

    private List<String> parsePermissionKeys(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            Object parsed = objectMapper.readValue(raw, Object.class);
            if (parsed instanceof List<?> values) {
                return values.stream().map(this::string).filter(value -> !value.isBlank()).toList();
            }
        } catch (JsonProcessingException ignored) {
            return List.of();
        }
        return List.of();
    }

    private List<String> allPermissionKeys() {
        return permissionTree().stream()
            .flatMap(item -> {
                List<String> keys = new ArrayList<>();
                keys.add(string(item.get("key")));
                Object children = item.get("children");
                if (children instanceof List<?> values) {
                    values.forEach(child -> {
                        if (child instanceof Map<?, ?> childMap) {
                            keys.add(string(childMap.get("key")));
                        }
                    });
                }
                return keys.stream();
            })
            .filter(value -> !value.isBlank())
            .toList();
    }

    private Map<String, Object> permissionModule(String key, String title, List<Map<String, Object>> children) {
        return row("key", key, "title", title, "children", children);
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

    private List<Map<String, Object>> rows(String sql, String paramName, Object value) {
        return jdbcClient.sql(sql)
            .param(paramName, value)
            .query(this::mapRow)
            .list();
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
