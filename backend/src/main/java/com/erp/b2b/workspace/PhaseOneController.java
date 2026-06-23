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
import jakarta.servlet.http.HttpServletRequest;
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
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.BadSqlGrammarException;
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
            WHERE refund_status IN ('SUCCESS','REFUNDED')
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
        long pendingAfterSale = count("SELECT COUNT(*) FROM after_sale_orders WHERE after_sale_status NOT IN ('COMPLETED','REJECTED','CLOSED','CANCELLED')");
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
                row("module", "售后管理", "title", "待审核售后", "count", count("SELECT COUNT(*) FROM after_sale_orders WHERE after_sale_status IN ('PENDING_REVIEW','WAIT_AUDIT')"), "target", "afterSales"),
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

    @GetMapping("/mall/browse-history")
    public List<Map<String, Object>> mallBrowseHistory(HttpServletRequest request) {
        Long customerId = buyerCustomerId(request);
        return rows("""
            SELECT h.id, h.product_id, h.view_count, h.viewed_at,
                   p.product_code, p.sku_barcode, p.product_name, p.category_name, p.brand_name,
                   p.sku_name, p.unit, p.quote_type, p.sale_mode, p.sale_unit, p.sale_unit_ratio,
                   p.sale_price, p.stock_quantity, p.min_order_quantity, p.sale_status,
                   CASE
                     WHEN LOWER(COALESCE(p.main_image_card_url, '')) LIKE 'data:image%' THEN ''
                     ELSE COALESCE(p.main_image_card_url, '')
                   END AS main_image_card_url,
                   CASE
                     WHEN LOWER(COALESCE(p.main_image_thumbnail_url, '')) LIKE 'data:image%' THEN ''
                     ELSE COALESCE(p.main_image_thumbnail_url, '')
                   END AS main_image_thumbnail_url
            FROM buyer_browse_history h
            JOIN products p ON p.id = h.product_id
            WHERE h.customer_id = :customerId
            ORDER BY h.viewed_at DESC, h.id DESC
            LIMIT 200
            """, "customerId", customerId);
    }

    @PostMapping("/mall/browse-history")
    @Transactional
    public Map<String, Object> recordMallBrowseHistory(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        Long customerId = buyerCustomerId(request);
        Long productId = requiredLong(payload, "productId");
        productRepository.findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
        jdbcClient.sql("""
            INSERT INTO buyer_browse_history (customer_id, product_id, view_count, viewed_at)
            VALUES (:customerId, :productId, 1, CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE
              view_count = view_count + 1,
              viewed_at = CURRENT_TIMESTAMP(6)
            """)
            .param("customerId", customerId)
            .param("productId", productId)
            .update();
        return row("recorded", true, "productId", productId);
    }

    @DeleteMapping("/mall/browse-history/{productId}")
    public Map<String, Object> deleteMallBrowseHistoryItem(HttpServletRequest request, @PathVariable Long productId) {
        Long customerId = buyerCustomerId(request);
        int deleted = jdbcClient.sql("""
            DELETE FROM buyer_browse_history
            WHERE customer_id = :customerId AND product_id = :productId
            """)
            .param("customerId", customerId)
            .param("productId", productId)
            .update();
        return row("deleted", deleted > 0, "productId", productId);
    }

    @DeleteMapping("/mall/browse-history")
    public Map<String, Object> clearMallBrowseHistory(HttpServletRequest request) {
        Long customerId = buyerCustomerId(request);
        int deleted = jdbcClient.sql("DELETE FROM buyer_browse_history WHERE customer_id = :customerId")
            .param("customerId", customerId)
            .update();
        return row("deleted", true, "deletedCount", deleted);
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
    public Map<String, Object> adminOrders(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(required = false) String tab,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String orderStatus,
        @RequestParam(required = false) String paymentStatus,
        @RequestParam(required = false) String fulfillmentStatus,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate
    ) {
        orderService.cancelExpiredUnpaidOrders();
        int safePage = Math.max(1, page);
        int safePageSize = Math.min(50, Math.max(1, pageSize));
        Map<String, Object> params = new LinkedHashMap<>();
        String where = adminOrderWhere(tab, keyword, orderStatus, paymentStatus, fulfillmentStatus, startDate, endDate, params);
        long total = jdbcClient.sql("SELECT COUNT(*) FROM sales_orders o " + where)
            .params(params)
            .query(Long.class)
            .single();
        params.put("limit", safePageSize);
        params.put("offset", (safePage - 1) * safePageSize);
        List<Map<String, Object>> orders = rows("""
            SELECT o.id, o.order_no, o.customer_id, o.customer_name, o.order_status, o.payment_status,
                   o.fulfillment_status, o.payment_method, o.total_amount, o.receiver_name, o.receiver_phone,
                   o.receiver_address, o.remark, o.created_at, o.updated_at,
                   CASE
                     WHEN o.payment_status = 'UNPAID' OR o.order_status IN ('WAIT_PAY','PENDING_PAYMENT','CANCELLED') THEN 'NONE'
                     WHEN EXISTS (
                       SELECT 1 FROM after_sale_orders a
                       WHERE a.order_no = o.order_no
                         AND a.after_sale_status NOT IN ('COMPLETED','REJECTED','CLOSED','CANCELLED')
                     ) THEN 'PROCESSING'
                     WHEN EXISTS (
                       SELECT 1 FROM after_sale_orders a
                       WHERE a.order_no = o.order_no
                     ) THEN 'COMPLETED'
                     ELSE 'NONE'
                   END AS after_sale_status,
                   CASE
                     WHEN EXISTS (
                       SELECT 1 FROM invoice_applies i
                       WHERE i.order_no = o.order_no
                         AND i.invoice_status = 'WAIT_INVOICE'
                     ) THEN 'WAIT_INVOICE'
                     WHEN EXISTS (
                       SELECT 1 FROM invoice_applies i
                       WHERE i.order_no = o.order_no
                         AND i.invoice_status = 'INVOICED'
                     ) THEN 'INVOICED'
                     WHEN EXISTS (
                       SELECT 1 FROM invoice_applies i
                       WHERE i.order_no = o.order_no
                     ) THEN 'APPLIED'
                     ELSE 'NONE'
                   END AS invoice_status,
                   COALESCE(s.shipment_count, 0) AS shipment_count
            FROM sales_orders o
            LEFT JOIN (
              SELECT order_id, COUNT(*) AS shipment_count
              FROM order_shipments
              GROUP BY order_id
            ) s ON s.order_id = o.id
            """ + where + """
            ORDER BY o.id DESC
            LIMIT :limit OFFSET :offset
            """, params);
        attachOrderItems(orders);
        return row("list", orders, "total", total, "page", safePage, "pageSize", safePageSize);
    }

    @GetMapping("/admin/orders/stats")
    public Map<String, Object> adminOrderStats() {
        orderService.cancelExpiredUnpaidOrders();
        Map<String, Object> stats = rows("""
            SELECT
              COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN payment_status = 'UNPAID' OR order_status IN ('WAIT_PAY','PENDING_PAYMENT') THEN 1 ELSE 0 END), 0) AS unpaid,
              COALESCE(SUM(CASE WHEN order_status NOT IN ('CANCELLED','COMPLETED')
                       AND fulfillment_status = 'UNSHIPPED'
                       AND (payment_status IN ('PAID','NOT_REQUIRED_BEFORE_RECEIPT') OR order_status IN ('WAIT_SHIP','PENDING_SHIPMENT'))
                       THEN 1 ELSE 0 END), 0) AS pending_shipment,
              COALESCE(SUM(CASE WHEN fulfillment_status IN ('PART_SHIPPED','PARTIAL_SHIPPED') OR order_status IN ('PART_SHIPPED','PARTIAL_SHIPPED') THEN 1 ELSE 0 END), 0) AS part_shipped,
              COALESCE(SUM(CASE WHEN order_status IN ('WAIT_RECEIVE','SHIPPED') OR fulfillment_status IN ('SHIPPED','NO_LOGISTICS') THEN 1 ELSE 0 END), 0) AS pending_receive,
              COALESCE(SUM(CASE WHEN order_status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed,
              COALESCE(SUM(CASE WHEN EXISTS (
                SELECT 1 FROM after_sale_orders a
                WHERE a.order_no = sales_orders.order_no
                  AND a.after_sale_status NOT IN ('COMPLETED','REJECTED','CLOSED','CANCELLED')
              ) AND sales_orders.payment_status <> 'UNPAID'
                AND sales_orders.order_status NOT IN ('WAIT_PAY','PENDING_PAYMENT','CANCELLED')
                THEN 1 ELSE 0 END), 0) AS after_sale,
              COALESCE(SUM(CASE WHEN EXISTS (
                SELECT 1 FROM invoice_applies i
                WHERE i.order_no = sales_orders.order_no
                  AND i.invoice_status = 'WAIT_INVOICE'
              ) THEN 1 ELSE 0 END), 0) AS invoice_pending
            FROM sales_orders
            """).get(0);
        return row(
            "total", longValue(stats.get("total")),
            "unpaid", longValue(stats.get("unpaid")),
            "pendingShipment", longValue(stats.get("pendingShipment")),
            "partShipped", longValue(stats.get("partShipped")),
            "pendingReceive", longValue(stats.get("pendingReceive")),
            "completed", longValue(stats.get("completed")),
            "afterSale", longValue(stats.get("afterSale")),
            "invoicePending", longValue(stats.get("invoicePending"))
        );
    }

    @GetMapping("/admin/orders/{orderId}")
    public Map<String, Object> adminOrderDetail(@PathVariable Long orderId) {
        orderService.cancelExpiredUnpaidOrders();
        Map<String, Object> order = one("""
            SELECT o.id, o.order_no, o.customer_id, o.customer_name, o.order_status, o.payment_status, o.fulfillment_status,
                   o.payment_method, o.payment_time, o.payment_no, o.receive_time, o.completed_time, o.total_amount,
                   o.receiver_name, o.receiver_phone, o.receiver_address, o.remark, o.created_at, o.updated_at,
                   c.customer_code AS buyer_account, c.contact_name, c.contact_phone
            FROM sales_orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            WHERE o.id = :id
            """, "id", orderId);
        attachOrderItems(List.of(order));
        String orderNo = string(order.get("orderNo"));
        boolean afterSaleAllowed = orderAllowsAfterSale(order);
        List<Map<String, Object>> shipments = optionalOrderRows(() -> orderShipments(orderId));
        List<Map<String, Object>> afterSales = afterSaleAllowed ? optionalOrderRows(() -> orderAfterSales(orderNo)) : List.of();
        Map<String, Object> invoice = optionalOrderMap(() -> orderInvoice(orderNo));
        List<Map<String, Object>> logs = optionalOrderRows(() -> orderLogs(orderId, orderNo));
        boolean isPaid = "PAID".equals(string(order.get("paymentStatus")));
        boolean isReceived = "RECEIVED".equals(string(order.get("fulfillmentStatus")));
        boolean isCompleted = "COMPLETED".equals(string(order.get("orderStatus")));
        Object paymentTime = firstPresent(order.get("paymentTime"), orderLogTime(logs, List.of("确认收款", "支付成功")), isPaid ? order.get("createdAt") : null);
        Object receiveTime = firstPresent(order.get("receiveTime"), orderLogTime(logs, List.of("确认收货")), isReceived || isCompleted ? order.get("updatedAt") : null);
        Object completedTime = firstPresent(order.get("completedTime"), isCompleted ? receiveTime : null, isCompleted ? order.get("updatedAt") : null);
        order.put("adminRemark", null);
        order.put("paymentTime", paymentTime);
        order.put("paymentNo", firstPresent(order.get("paymentNo"), isPaid ? "PAY" + orderNo.replace("SO", "") : null));
        order.put("shipmentTime", shipments.isEmpty() ? null : shipments.get(shipments.size() - 1).get("createdAt"));
        order.put("receiveTime", receiveTime);
        order.put("completedTime", completedTime);
        order.put("shipments", shipments);
        order.put("afterSales", afterSales);
        order.put("afterSaleStatus", afterSales.isEmpty() ? "NONE" : afterSales.stream().anyMatch(item -> !List.of("COMPLETED", "REJECTED", "CLOSED", "CANCELLED").contains(string(item.get("status")))) ? "PROCESSING" : "COMPLETED");
        order.put("invoice", invoice);
        order.put("invoiceStatus", invoice == null ? "NONE" : string(invoice.getOrDefault("status", "APPLIED")));
        order.put("logs", logs);
        return order;
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
            shipmentMethod,
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
        logAs(operatorName, "订单管理", "订单发货", order.orderNo(), "订单发货 " + shipmentNo);
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

    @PostMapping("/admin/orders/{orderId}/cancel")
    @Transactional
    public Map<String, Object> cancelAdminOrder(@PathVariable Long orderId, @RequestBody Map<String, Object> request) {
        String operatorName = requiredString(request, "operatorName");
        validateAdminOperator(operatorName);
        var current = orderService.getOrder(orderId);
        if ("PAID".equals(current.paymentStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "已支付订单请走退款/售后流程");
        }
        var cancelled = orderService.cancelUnpaidOrder(orderId);
        logAs(operatorName, "订单管理", "后台取消订单", cancelled.orderNo(), string(request.getOrDefault("reason", "后台取消")));
        return adminOrderDetail(orderId);
    }

    @PostMapping("/admin/orders/{orderId}/confirm-payment")
    @Transactional
    public Map<String, Object> confirmAdminOrderPayment(@PathVariable Long orderId, @RequestBody Map<String, Object> request) {
        String operatorName = requiredString(request, "operatorName");
        validateAdminOperator(operatorName);
        var current = orderService.getOrder(orderId);
        if (!"UNPAID".equals(current.paymentStatus()) || !List.of("WAIT_PAY", "WAIT_CONFIRM", "PENDING_PAYMENT").contains(current.orderStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "仅未支付订单允许确认收款");
        }
        var paid = orderService.markPaid(orderId);
        String paymentMethod = string(request.getOrDefault("paymentMethod", "OFFLINE"));
        String paymentRemark = string(request.getOrDefault("paymentRemark", "线下转账确认收款"));
        logAs(operatorName, "订单管理", "确认收款", paid.orderNo(), paymentMethod + " " + paymentRemark);
        return adminOrderDetail(orderId);
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
        Object cancelled = orderService.cancelUnpaidOrder(orderId);
        log("订单管理", "取消订单", String.valueOf(orderId), "买家取消待支付订单");
        return cancelled;
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
        log("财务管理", "支付成功", order.orderNo(), "订单支付成功 " + paymentNo);
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
            SELECT COALESCE(refund_no, CONCAT('RF', id)) AS refund_no, after_sale_no, order_no, buyer_name,
                   COALESCE(refund_method, 'MANUAL') AS refund_method,
                   COALESCE(approved_amount, refund_amount, apply_amount, 0) AS amount,
                   COALESCE(refund_status, 'WAIT_REFUND') AS refund_status,
                   COALESCE(refunded_at, updated_at) AS refunded_at
            FROM after_sale_orders
            WHERE refund_status IS NOT NULL OR after_sale_status IN ('WAIT_REFUND','COMPLETED')
            ORDER BY id DESC
            """).stream().map(this::normalizeAfterSaleRow).toList();
    }

    @GetMapping("/admin/finance/payment-exceptions")
    public List<Map<String, Object>> paymentExceptions() {
        return List.of();
    }

    @GetMapping("/admin/after-sales/stats")
    public Map<String, Object> afterSaleStats() {
        Map<String, Object> stats = rows("""
            SELECT
              COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN after_sale_status IN ('PENDING_REVIEW','WAIT_AUDIT') THEN 1 ELSE 0 END), 0) AS pending_review,
              COALESCE(SUM(CASE WHEN after_sale_status = 'WAIT_BUYER_RETURN' THEN 1 ELSE 0 END), 0) AS wait_buyer_return,
              COALESCE(SUM(CASE WHEN after_sale_status IN ('WAIT_SELLER_RECEIVE','WAIT_RETURN_RECEIVE') THEN 1 ELSE 0 END), 0) AS wait_seller_receive,
              COALESCE(SUM(CASE WHEN after_sale_status = 'WAIT_REFUND' THEN 1 ELSE 0 END), 0) AS wait_refund,
              COALESCE(SUM(CASE WHEN after_sale_status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed,
              COALESCE(SUM(CASE WHEN after_sale_status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected,
              COALESCE(SUM(CASE
                WHEN after_sale_status IN ('WAIT_BUYER_RETURN','WAIT_SELLER_RECEIVE','WAIT_RETURN_RECEIVE')
                 AND after_sale_deadline_at IS NOT NULL
                 AND after_sale_deadline_at < NOW()
                THEN 1 ELSE 0 END), 0) AS timeout
            FROM after_sale_orders
            """).get(0);
        return row(
            "total", longValue(stats.get("total")),
            "pendingReview", longValue(stats.get("pendingReview")),
            "waitBuyerReturn", longValue(stats.get("waitBuyerReturn")),
            "waitSellerReceive", longValue(stats.get("waitSellerReceive")),
            "waitRefund", longValue(stats.get("waitRefund")),
            "completed", longValue(stats.get("completed")),
            "rejected", longValue(stats.get("rejected")),
            "timeout", longValue(stats.get("timeout"))
        );
    }

    @GetMapping("/admin/after-sales")
    public Map<String, Object> afterSales(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(required = false) String tab,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String afterSaleType,
        @RequestParam(required = false) String afterSaleStatus,
        @RequestParam(required = false) String refundStatus,
        @RequestParam(required = false) String orderStatus,
        @RequestParam(required = false) String productKeyword,
        @RequestParam(required = false) Boolean timeoutOnly,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate
    ) {
        int safePage = Math.max(1, page);
        int safePageSize = Math.min(50, Math.max(1, pageSize));
        Map<String, Object> params = new LinkedHashMap<>();
        String where = afterSaleWhere(tab, keyword, afterSaleType, afterSaleStatus, refundStatus, orderStatus, productKeyword, timeoutOnly, startDate, endDate, params);
        long total = jdbcClient.sql("SELECT COUNT(*) FROM after_sale_orders a LEFT JOIN sales_orders o ON o.order_no = a.order_no " + where)
            .params(params)
            .query(Long.class)
            .single();
        params.put("limit", safePageSize);
        params.put("offset", (safePage - 1) * safePageSize);
        List<Map<String, Object>> list = rows(afterSaleListSql() + where + " ORDER BY a.id DESC LIMIT :limit OFFSET :offset", params)
            .stream()
            .map(this::normalizeAfterSaleRow)
            .toList();
        return row("list", list, "total", total, "page", safePage, "pageSize", safePageSize);
    }

    @GetMapping("/admin/after-sales/{afterSaleId}")
    public Map<String, Object> afterSaleDetail(@PathVariable Long afterSaleId) {
        Map<String, Object> detail = rows(afterSaleListSql() + " WHERE a.id = :id", "id", afterSaleId)
            .stream()
            .findFirst()
            .map(this::normalizeAfterSaleRow)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "售后单不存在"));
        String afterSaleNo = string(detail.get("afterSaleNo"));
        String orderNo = string(detail.get("orderNo"));
        Long orderId = detail.get("orderId") instanceof Number number ? number.longValue() : null;
        detail.put("progress", afterSaleProgress(detail));
        detail.put("order", afterSaleOrderInfo(orderNo));
        detail.put("product", afterSaleProductInfo(detail));
        detail.put("application", afterSaleApplicationInfo(detail));
        detail.put("audit", afterSaleAuditInfo(detail));
        detail.put("returnLogistics", returnLogistics(afterSaleId));
        detail.put("refund", afterSaleRefundInfo(detail));
        Map<String, Object> invoiceImpact = afterSaleInvoiceImpact(orderNo);
        detail.put("invoiceImpact", invoiceImpact);
        detail.put("invoiceRefundWarning", string(invoiceImpact.get("tip")).contains("红冲"));
        detail.put("inventoryImpact", afterSaleInventoryImpact(detail));
        detail.put("logs", afterSaleLogs(afterSaleNo, afterSaleId, orderId));
        return detail;
    }

    @GetMapping("/mall/after-sales")
    public Map<String, Object> mallAfterSales() {
        return afterSales(1, 50, null, null, null, null, null, null, null, null, null, null);
    }

    @GetMapping("/mall/after-sales/{afterSaleId}")
    public Map<String, Object> mallAfterSaleDetail(@PathVariable Long afterSaleId) {
        return afterSaleDetail(afterSaleId);
    }

    @PostMapping({"/mall/after-sales", "/admin/after-sales"})
    @Transactional
    public Map<String, Object> createAfterSale(@RequestBody Map<String, Object> request) {
        String orderNo = requiredString(request, "orderNo");
        Map<String, Object> order = one("SELECT * FROM sales_orders WHERE order_no = :orderNo", "orderNo", orderNo);
        String productName = requiredString(request, "productName");
        int quantity = positiveInt(request, request.containsKey("applyQuantity") ? "applyQuantity" : "quantity");
        BigDecimal applyAmount = nonNegativeMoney(request, request.containsKey("applyAmount") ? "applyAmount" : "refundAmount");
        BigDecimal refundedAmount = decimalValue(order.get("refundedAmount"), BigDecimal.ZERO);
        BigDecimal refundableAmount = decimalValue(order.get("totalAmount"), BigDecimal.ZERO).subtract(refundedAmount).max(BigDecimal.ZERO);
        if (applyAmount.compareTo(refundableAmount) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "申请退款金额不能大于可退金额");
        }
        Map<String, Object> item = findOrderItem(orderNo, request, productName);
        int alreadyAfterSale = afterSaleQuantity(orderNo, longObject(item.get("productId")), string(item.get("skuCode")));
        int purchasedQuantity = intValue(item.get("quantity"), quantity);
        if (quantity + alreadyAfterSale > purchasedQuantity) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "本次申请数量超过可售后数量");
        }
        String type = normalizeAfterSaleType(request.getOrDefault("afterSaleType", request.getOrDefault("type", "REFUND_ONLY")));
        String afterSaleNo = "AS" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO after_sale_orders (
              after_sale_no, order_no, order_id, customer_id, buyer_name, customer_phone,
              after_sale_type, product_id, product_name, product_image, sku_code, sku_name,
              quantity, refund_amount, apply_amount, refundable_amount, after_sale_status,
              reason, description, refund_status, credential_urls, after_sale_deadline_at
            )
            VALUES (
              :afterSaleNo, :orderNo, :orderId, :customerId, :buyerName, :customerPhone,
              :type, :productId, :productName, :productImage, :skuCode, :skuName,
              :quantity, :applyAmount, :applyAmount, :refundableAmount, 'PENDING_REVIEW',
              :reason, :description, 'NOT_REFUNDED', :credentialUrls, DATE_ADD(COALESCE(:completedAt, NOW()), INTERVAL 7 DAY)
            )
            """)
            .param("afterSaleNo", afterSaleNo)
            .param("orderNo", orderNo)
            .param("orderId", order.get("id"))
            .param("customerId", order.get("customerId"))
            .param("buyerName", string(firstPresent(request.get("buyerName"), order.get("customerName"))))
            .param("customerPhone", string(firstPresent(request.get("customerPhone"), order.get("receiverPhone"))))
            .param("type", type)
            .param("productId", item.get("productId"))
            .param("productName", productName)
            .param("productImage", safeImage(firstPresent(item.get("mainImageThumbnailUrl"), item.get("mainImageCardUrl"), item.get("mainImageUrl"), request.get("productImage"))))
            .param("skuCode", string(firstPresent(request.get("skuCode"), item.get("skuCode"))))
            .param("skuName", string(firstPresent(request.get("skuName"), item.get("skuName"))))
            .param("quantity", quantity)
            .param("applyAmount", applyAmount)
            .param("refundableAmount", refundableAmount)
            .param("reason", string(request.getOrDefault("reason", "买家申请售后")))
            .param("description", string(request.getOrDefault("description", "")))
            .param("credentialUrls", jsonText(request.getOrDefault("credentialUrls", request.getOrDefault("proofImages", List.of()))))
            .param("completedAt", order.get("updatedAt"))
            .update();
        log("售后管理", "买家提交售后", afterSaleNo, "提交售后申请");
        return afterSaleDetail(longValue(one("SELECT id FROM after_sale_orders WHERE after_sale_no = :afterSaleNo", "afterSaleNo", afterSaleNo).get("id")));
    }

    @PostMapping("/mall/after-sales/{afterSaleId}/cancel")
    public Map<String, Object> cancelAfterSale(@PathVariable Long afterSaleId) {
        jdbcClient.sql("UPDATE after_sale_orders SET after_sale_status = 'CLOSED', close_reason = '买家取消申请', closed_at = NOW() WHERE id = :id AND after_sale_status IN ('PENDING_REVIEW','WAIT_AUDIT')")
            .param("id", afterSaleId)
            .update();
        Map<String, Object> detail = afterSaleDetail(afterSaleId);
        log("售后管理", "买家取消售后", string(detail.get("afterSaleNo")), "买家取消售后申请");
        return detail;
    }

    @PostMapping("/mall/after-sales/{afterSaleId}/return-logistics")
    public Map<String, Object> submitReturnLogistics(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        Map<String, Object> current = afterSaleDetail(afterSaleId);
        requireAfterSaleStatus(current, "WAIT_BUYER_RETURN");
        jdbcClient.sql("""
            INSERT INTO after_sale_return_logistics (after_sale_id, logistics_company, logistics_no, shipped_at, remark)
            VALUES (:afterSaleId, :logisticsCompany, :logisticsNo, NOW(), :remark)
            """)
            .param("afterSaleId", afterSaleId)
            .param("logisticsCompany", requiredString(request, "logisticsCompany"))
            .param("logisticsNo", requiredString(request, "logisticsNo"))
            .param("remark", string(request.getOrDefault("remark", "")))
            .update();
        jdbcClient.sql("UPDATE after_sale_orders SET after_sale_status = 'WAIT_SELLER_RECEIVE' WHERE id = :id")
            .param("id", afterSaleId)
            .update();
        log("售后管理", "买家填写退货物流", string(current.get("afterSaleNo")), "买家填写退货物流");
        return afterSaleDetail(afterSaleId);
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/review")
    @Transactional
    public Map<String, Object> reviewAfterSale(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        Map<String, Object> current = afterSaleDetail(afterSaleId);
        requireAfterSaleStatus(current, "PENDING_REVIEW");
        String operatorName = requiredString(request, "operatorName");
        validateAdminOperator(operatorName);
        String action = string(request.getOrDefault("action", "APPROVE")).trim().toUpperCase();
        if ("REJECT".equals(action)) {
            String rejectReason = requiredString(request, "rejectReason");
            String remark = string(request.getOrDefault("remark", ""));
            jdbcClient.sql("""
                UPDATE after_sale_orders
                SET after_sale_status = 'REJECTED',
                    audit_remark = :remark,
                    reviewer_name = :operatorName,
                    reviewed_at = NOW(),
                    reject_reason = :rejectReason
                WHERE id = :id
                """)
                .param("remark", remark)
                .param("operatorName", operatorName)
                .param("rejectReason", rejectReason)
                .param("id", afterSaleId)
                .update();
            logAs(operatorName, "售后管理", "后台审核拒绝", string(current.get("afterSaleNo")), rejectReason);
            return afterSaleDetail(afterSaleId);
        }
        String processType = normalizeAfterSaleType(request.getOrDefault("processType", current.get("afterSaleType")));
        BigDecimal approvedAmount = positiveMoney(request, "approvedAmount");
        BigDecimal applyAmount = decimalValue(current.get("applyAmount"), BigDecimal.ZERO);
        BigDecimal refundableAmount = decimalValue(current.get("refundableAmount"), applyAmount);
        if (approvedAmount.compareTo(applyAmount) > 0 || approvedAmount.compareTo(refundableAmount) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "同意退款金额不能大于申请金额和可退金额");
        }
        boolean needReturn = "RETURN_REFUND".equals(processType);
        String returnAddress = needReturn ? requiredString(request, "returnAddress") : "";
        String nextStatus = needReturn ? "WAIT_BUYER_RETURN" : "WAIT_REFUND";
        jdbcClient.sql("""
            UPDATE after_sale_orders
            SET after_sale_status = :nextStatus,
                refund_status = 'WAIT_REFUND',
                audit_remark = :remark,
                reviewer_name = :operatorName,
                reviewed_at = NOW(),
                approved_amount = :approvedAmount,
                process_type = :processType,
                need_return = :needReturn,
                return_address = :returnAddress
            WHERE id = :id
            """)
            .param("nextStatus", nextStatus)
            .param("remark", string(request.getOrDefault("remark", "")))
            .param("operatorName", operatorName)
            .param("approvedAmount", approvedAmount)
            .param("processType", processType)
            .param("needReturn", needReturn)
            .param("returnAddress", returnAddress)
            .param("id", afterSaleId)
            .update();
        logAs(operatorName, "售后管理", "后台审核通过", string(current.get("afterSaleNo")), "售后审核通过，进入" + nextStatus);
        return afterSaleDetail(afterSaleId);
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/audit")
    public Map<String, Object> auditAfterSale(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        boolean approved = Boolean.parseBoolean(String.valueOf(request.getOrDefault("approved", true)));
        Map<String, Object> body = new LinkedHashMap<>(request);
        body.put("action", approved ? "APPROVE" : "REJECT");
        body.putIfAbsent("operatorName", "1001");
        if (approved) {
            Map<String, Object> current = afterSaleDetail(afterSaleId);
            body.putIfAbsent("approvedAmount", firstPresent(current.get("applyAmount"), current.get("refundAmount"), BigDecimal.ZERO));
            body.putIfAbsent("processType", current.get("afterSaleType"));
        } else {
            body.putIfAbsent("rejectReason", string(request.getOrDefault("remark", "审核拒绝")));
        }
        return reviewAfterSale(afterSaleId, body);
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/receive-return")
    @Transactional
    public Map<String, Object> receiveReturn(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        Map<String, Object> current = afterSaleDetail(afterSaleId);
        requireAfterSaleStatus(current, "WAIT_SELLER_RECEIVE");
        String operatorName = requiredString(request, "operatorName");
        validateAdminOperator(operatorName);
        int receivedQuantity = positiveInt(request, "receivedQuantity");
        int applyQuantity = intValue(current.get("applyQuantity"), intValue(current.get("quantity"), 0));
        if (receivedQuantity > applyQuantity) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "实收数量不能大于申请退货数量");
        }
        String receiveResult = string(request.getOrDefault("receiveResult", "NORMAL")).trim().toUpperCase();
        if (!List.of("NORMAL", "ABNORMAL").contains(receiveResult)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "收货结果不正确");
        }
        String abnormalReason = string(request.getOrDefault("abnormalReason", "")).trim();
        if ("ABNORMAL".equals(receiveResult) && abnormalReason.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "异常收货请填写异常说明");
        }
        boolean returnToStock = Boolean.parseBoolean(String.valueOf(request.getOrDefault("returnToStock", true)));
        if (returnToStock) {
            Long productId = longObject(current.get("productId"));
            if (productId != null) {
                int updated = productRepository.addStock(productId, receivedQuantity);
                if (updated != 1) {
                    throw new ApiException(HttpStatus.CONFLICT, "退货入库失败，商品不存在");
                }
                Product latest = productRepository.findById(productId).orElseThrow();
                inventoryRepository.insertMovement(productId, "RETURN_INBOUND", receivedQuantity, latest.stockQuantity(), "AFTER_SALE", string(current.get("afterSaleNo")), "售后退货入库");
            }
        }
        jdbcClient.sql("""
            UPDATE after_sale_orders
            SET after_sale_status = 'WAIT_REFUND',
                received_quantity = :receivedQuantity,
                receive_result = :receiveResult,
                abnormal_reason = :abnormalReason,
                return_to_stock = :returnToStock,
                received_at = NOW(),
                receive_operator_name = :operatorName,
                receive_remark = :remark
            WHERE id = :id
            """)
            .param("receivedQuantity", receivedQuantity)
            .param("receiveResult", receiveResult)
            .param("abnormalReason", abnormalReason)
            .param("returnToStock", returnToStock)
            .param("operatorName", operatorName)
            .param("remark", string(request.getOrDefault("remark", "")))
            .param("id", afterSaleId)
            .update();
        logAs(operatorName, "售后管理", "后台确认收货", string(current.get("afterSaleNo")), returnToStock ? "确认收货并入库" : "确认收货不入库");
        return afterSaleDetail(afterSaleId);
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/confirm-return-received")
    @Transactional
    public Map<String, Object> confirmReturnReceived(@PathVariable Long afterSaleId) {
        Map<String, Object> current = afterSaleDetail(afterSaleId);
        return receiveReturn(afterSaleId, row(
            "receivedQuantity", Math.max(1, intValue(current.get("applyQuantity"), intValue(current.get("quantity"), 1))),
            "receiveResult", "NORMAL",
            "returnToStock", true,
            "remark", "退货已收到",
            "operatorName", "1001"
        ));
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/confirm-refund")
    @Transactional
    public Map<String, Object> confirmRefund(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        Map<String, Object> current = afterSaleDetail(afterSaleId);
        requireAfterSaleStatus(current, "WAIT_REFUND");
        String operatorName = requiredString(request, "operatorName");
        validateAdminOperator(operatorName);
        BigDecimal refundAmount = positiveMoney(request, "refundAmount");
        BigDecimal approvedAmount = decimalValue(firstPresent(current.get("approvedAmount"), current.get("applyAmount")), BigDecimal.ZERO);
        BigDecimal refundableAmount = decimalValue(current.get("refundableAmount"), approvedAmount);
        if (refundAmount.compareTo(approvedAmount) > 0 || refundAmount.compareTo(refundableAmount) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "退款金额不能大于审核通过金额和可退金额");
        }
        jdbcClient.sql("""
            UPDATE after_sale_orders
            SET after_sale_status = 'COMPLETED',
                refund_status = 'REFUNDED',
                refund_method = :refundMethod,
                refund_no = :refundNo,
                refund_operator_name = :operatorName,
                refunded_at = NOW(),
                refund_remark = :remark,
                refund_amount = :refundAmount
            WHERE id = :id
            """)
            .param("refundMethod", string(request.getOrDefault("refundMethod", "MANUAL")).trim().toUpperCase())
            .param("refundNo", string(request.getOrDefault("refundNo", "")))
            .param("operatorName", operatorName)
            .param("remark", string(request.getOrDefault("remark", "")))
            .param("refundAmount", refundAmount)
            .param("id", afterSaleId)
            .update();
        syncOrderRefund(string(current.get("orderNo")), refundAmount);
        logAs(operatorName, "售后管理", "后台确认退款", string(current.get("afterSaleNo")), "确认退款 " + refundAmount);
        Map<String, Object> refreshed = afterSaleDetail(afterSaleId);
        if (Boolean.TRUE.equals(refreshed.get("invoiceRefundWarning"))) {
            logAs(operatorName, "开票管理", "已开票订单退款提示", string(current.get("afterSaleNo")), "已开票订单发生退款，后续需处理红冲");
        }
        return refreshed;
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/refund")
    public Map<String, Object> refundAfterSale(@PathVariable Long afterSaleId) {
        Map<String, Object> current = afterSaleDetail(afterSaleId);
        return confirmRefund(afterSaleId, row(
            "refundMethod", "MANUAL",
            "refundAmount", firstPresent(current.get("approvedAmount"), current.get("applyAmount"), current.get("refundAmount"), BigDecimal.ONE),
            "refundNo", "RF" + System.currentTimeMillis() % 100000,
            "remark", "后台手动确认退款",
            "operatorName", "1001"
        ));
    }

    @PostMapping("/admin/after-sales/{afterSaleId}/close")
    @Transactional
    public Map<String, Object> closeAfterSale(@PathVariable Long afterSaleId, @RequestBody Map<String, Object> request) {
        Map<String, Object> current = afterSaleDetail(afterSaleId);
        requireAfterSaleStatus(current, "WAIT_BUYER_RETURN");
        String operatorName = requiredString(request, "operatorName");
        validateAdminOperator(operatorName);
        String reason = requiredString(request, "reason");
        jdbcClient.sql("""
            UPDATE after_sale_orders
            SET after_sale_status = 'CLOSED',
                close_reason = :reason,
                closed_by = :operatorName,
                closed_at = NOW()
            WHERE id = :id
            """)
            .param("reason", reason)
            .param("operatorName", operatorName)
            .param("id", afterSaleId)
            .update();
        logAs(operatorName, "售后管理", "后台关闭售后", string(current.get("afterSaleNo")), reason);
        return afterSaleDetail(afterSaleId);
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
        Map<String, Object> order = one("SELECT id, total_amount, COALESCE(refunded_amount, 0) AS refunded_amount FROM sales_orders WHERE order_no = :orderNo", "orderNo", orderNo);
        if (activeAfterSaleCount(orderNo) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "售后处理中，订单不允许申请开票");
        }
        String invoiceTitle = requiredString(request, request.containsKey("title") ? "title" : "invoiceTitle");
        BigDecimal amount = nonNegativeMoney(request, "amount");
        BigDecimal invoiceableAmount = decimalValue(order.get("totalAmount"), BigDecimal.ZERO).subtract(decimalValue(order.get("refundedAmount"), BigDecimal.ZERO)).max(BigDecimal.ZERO);
        if (invoiceableAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "订单已全额退款，不允许申请开票");
        }
        if (amount.compareTo(invoiceableAmount) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "申请开票金额不能大于退款后可开票金额");
        }
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

    private Long buyerCustomerId(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.startsWith("Bearer ")
            ? authorization.substring(7).trim()
            : "";
        String subject = authTokenService.subject(token, "BUYER");
        if (subject.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Please login first");
        }
        try {
            Long customerId = Long.parseLong(subject);
            Long count = jdbcClient.sql("SELECT COUNT(*) FROM customers WHERE id = :customerId")
                .param("customerId", customerId)
                .query(Long.class)
                .single();
            if (count == null || count <= 0) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Buyer account not found");
            }
            return customerId;
        } catch (NumberFormatException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid buyer account");
        }
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

    private String afterSaleListSql() {
        return """
            SELECT a.id, a.after_sale_no, a.order_no, COALESCE(a.order_id, o.id) AS order_id,
                   COALESCE(a.customer_id, o.customer_id) AS customer_id,
                   COALESCE(a.buyer_name, o.customer_name) AS buyer_name,
                   COALESCE(a.buyer_name, o.customer_name) AS customer_name,
                   COALESCE(a.customer_phone, o.receiver_phone) AS customer_phone,
                   a.after_sale_type, a.process_type, a.product_id, a.product_name,
                   COALESCE(a.product_image,
                     CASE WHEN LOWER(COALESCE(p.main_image_thumbnail_url, '')) LIKE 'data:image%' THEN '' ELSE p.main_image_thumbnail_url END,
                     CASE WHEN LOWER(COALESCE(p.main_image_card_url, '')) LIKE 'data:image%' THEN '' ELSE p.main_image_card_url END,
                     CASE WHEN LOWER(COALESCE(p.main_image_url, '')) LIKE 'data:image%' THEN '' ELSE p.main_image_url END
                   ) AS product_image,
                   a.sku_code, a.sku_name,
                   a.quantity AS apply_quantity,
                   a.quantity,
                   COALESCE(NULLIF(a.apply_amount, 0), a.refund_amount, 0) AS apply_amount,
                   COALESCE(NULLIF(a.refundable_amount, 0), o.total_amount - COALESCE(o.refunded_amount, 0), a.refund_amount, 0) AS refundable_amount,
                   a.approved_amount,
                   a.refund_amount,
                   a.after_sale_status,
                   a.reason,
                   a.description,
                   a.audit_remark,
                   a.need_return,
                   a.return_address,
                   a.reviewer_name,
                   a.reviewed_at,
                   a.reject_reason,
                   a.refund_status,
                   a.refund_method,
                   a.refund_no,
                   a.refund_operator_name,
                   a.refunded_at,
                   a.refund_remark,
                   a.received_quantity,
                   a.receive_result,
                   a.abnormal_reason,
                   a.return_to_stock,
                   a.received_at,
                   a.receive_operator_name,
                   a.receive_remark,
                   a.close_reason,
                   a.closed_by,
                   a.closed_at,
                   a.credential_urls,
                   a.after_sale_deadline_at,
                   o.order_status,
                   o.payment_status,
                   o.fulfillment_status,
                   o.total_amount AS order_amount,
                   COALESCE(o.refunded_amount, 0) AS order_refunded_amount,
                   o.receiver_name,
                   o.receiver_phone,
                   o.updated_at AS order_updated_at,
                   a.created_at,
                   a.updated_at
            FROM after_sale_orders a
            LEFT JOIN sales_orders o ON o.order_no = a.order_no
            LEFT JOIN products p ON p.id = a.product_id
            """;
    }

    private String afterSaleWhere(
        String tab,
        String keyword,
        String afterSaleType,
        String afterSaleStatus,
        String refundStatus,
        String orderStatus,
        String productKeyword,
        Boolean timeoutOnly,
        String startDate,
        String endDate,
        Map<String, Object> params
    ) {
        List<String> conditions = new ArrayList<>();
        String tabStatus = string(tab).trim();
        if (!tabStatus.isBlank() && !"ALL".equalsIgnoreCase(tabStatus)) {
            addAfterSaleStatusCondition(conditions, params, "tabStatuses", tabStatus);
        }
        String status = string(afterSaleStatus).trim();
        if (!status.isBlank()) {
            addAfterSaleStatusCondition(conditions, params, "afterSaleStatuses", status);
        }
        String type = string(afterSaleType).trim();
        if (!type.isBlank()) {
            params.put("afterSaleTypes", afterSaleTypeValues(type));
            conditions.add("a.after_sale_type IN (:afterSaleTypes)");
        }
        String refund = string(refundStatus).trim();
        if (!refund.isBlank()) {
            params.put("refundStatuses", refundStatusValues(refund));
            conditions.add("COALESCE(a.refund_status, 'NOT_REFUNDED') IN (:refundStatuses)");
        }
        String order = string(orderStatus).trim();
        if (!order.isBlank()) {
            params.put("orderStatuses", orderStatusValues(order));
            conditions.add("o.order_status IN (:orderStatuses)");
        }
        String keywordValue = string(keyword).trim();
        if (!keywordValue.isBlank()) {
            params.put("keyword", "%" + keywordValue + "%");
            conditions.add("(a.after_sale_no LIKE :keyword OR a.order_no LIKE :keyword OR a.buyer_name LIKE :keyword OR a.customer_phone LIKE :keyword OR o.receiver_phone LIKE :keyword)");
        }
        String productValue = string(productKeyword).trim();
        if (!productValue.isBlank()) {
            params.put("productKeyword", "%" + productValue + "%");
            conditions.add("(a.product_name LIKE :productKeyword OR a.sku_code LIKE :productKeyword OR a.sku_name LIKE :productKeyword)");
        }
        if (timeoutOnly != null) {
            String timeoutCondition = "a.after_sale_deadline_at IS NOT NULL AND a.after_sale_deadline_at < NOW() AND a.after_sale_status IN ('WAIT_BUYER_RETURN','WAIT_SELLER_RECEIVE','WAIT_RETURN_RECEIVE')";
            conditions.add(timeoutOnly ? timeoutCondition : "NOT (" + timeoutCondition + ")");
        }
        String start = string(startDate).trim();
        if (!start.isBlank()) {
            params.put("startDate", start);
            conditions.add("a.created_at >= :startDate");
        }
        String end = string(endDate).trim();
        if (!end.isBlank()) {
            params.put("endDate", end);
            conditions.add("a.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)");
        }
        return conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
    }

    private void addAfterSaleStatusCondition(List<String> conditions, Map<String, Object> params, String key, String status) {
        if ("TIMEOUT".equalsIgnoreCase(status)) {
            conditions.add("a.after_sale_deadline_at IS NOT NULL AND a.after_sale_deadline_at < NOW() AND a.after_sale_status IN ('WAIT_BUYER_RETURN','WAIT_SELLER_RECEIVE','WAIT_RETURN_RECEIVE')");
            return;
        }
        params.put(key, afterSaleStatusValues(status));
        conditions.add("a.after_sale_status IN (:" + key + ")");
    }

    private List<String> afterSaleStatusValues(String value) {
        return switch (normalizeAfterSaleStatus(value)) {
            case "PENDING_REVIEW" -> List.of("PENDING_REVIEW", "WAIT_AUDIT");
            case "WAIT_SELLER_RECEIVE" -> List.of("WAIT_SELLER_RECEIVE", "WAIT_RETURN_RECEIVE");
            case "CLOSED" -> List.of("CLOSED", "CANCELLED");
            default -> List.of(normalizeAfterSaleStatus(value));
        };
    }

    private List<String> afterSaleTypeValues(String value) {
        return switch (normalizeAfterSaleType(value)) {
            case "REFUND_ONLY" -> List.of("REFUND_ONLY", "ONLY_REFUND");
            case "RETURN_REFUND" -> List.of("RETURN_REFUND");
            default -> List.of(value);
        };
    }

    private List<String> refundStatusValues(String value) {
        return switch (normalizeRefundStatus(value)) {
            case "REFUNDED" -> List.of("REFUNDED", "SUCCESS");
            default -> List.of(normalizeRefundStatus(value));
        };
    }

    private List<String> orderStatusValues(String value) {
        return switch (string(value).trim().toUpperCase()) {
            case "WAIT_PAY", "PENDING_PAYMENT" -> List.of("WAIT_PAY", "PENDING_PAYMENT");
            case "WAIT_SHIP", "PENDING_SHIPMENT" -> List.of("WAIT_SHIP", "PENDING_SHIPMENT");
            case "WAIT_RECEIVE", "SHIPPED" -> List.of("WAIT_RECEIVE", "SHIPPED");
            case "CANCELLED", "CANCELED" -> List.of("CANCELLED", "CANCELED");
            default -> List.of(string(value).trim().toUpperCase());
        };
    }

    private Map<String, Object> normalizeAfterSaleRow(Map<String, Object> row) {
        String status = normalizeAfterSaleStatus(row.getOrDefault("afterSaleStatus", row.get("status")));
        String type = normalizeAfterSaleType(row.getOrDefault("afterSaleType", row.get("type")));
        String refundStatus = normalizeRefundStatus(row.get("refundStatus"));
        row.put("afterSaleStatus", status);
        row.put("status", status);
        row.put("afterSaleType", type);
        row.put("type", type);
        row.put("refundStatus", refundStatus);
        row.put("applyQuantity", intValue(firstPresent(row.get("applyQuantity"), row.get("quantity")), 0));
        row.put("applyAmount", decimalValue(firstPresent(row.get("applyAmount"), row.get("refundAmount")), BigDecimal.ZERO));
        row.put("refundableAmount", decimalValue(firstPresent(row.get("refundableAmount"), row.get("applyAmount")), BigDecimal.ZERO));
        row.put("timeout", afterSaleTimedOut(row));
        row.put("productImage", safeImage(row.get("productImage")));
        return row;
    }

    private String normalizeAfterSaleStatus(Object value) {
        return switch (string(value).trim().toUpperCase()) {
            case "", "WAIT_AUDIT" -> "PENDING_REVIEW";
            case "WAIT_RETURN_RECEIVE" -> "WAIT_SELLER_RECEIVE";
            case "CANCELLED", "CANCELED" -> "CLOSED";
            default -> string(value).trim().toUpperCase();
        };
    }

    private String normalizeAfterSaleType(Object value) {
        return switch (string(value).trim().toUpperCase()) {
            case "", "ONLY_REFUND" -> "REFUND_ONLY";
            default -> string(value).trim().toUpperCase();
        };
    }

    private String normalizeRefundStatus(Object value) {
        return switch (string(value).trim().toUpperCase()) {
            case "", "NULL" -> "NOT_REFUNDED";
            case "SUCCESS" -> "REFUNDED";
            default -> string(value).trim().toUpperCase();
        };
    }

    private boolean afterSaleTimedOut(Map<String, Object> row) {
        String status = normalizeAfterSaleStatus(row.get("afterSaleStatus"));
        if (!List.of("WAIT_BUYER_RETURN", "WAIT_SELLER_RECEIVE").contains(status)) return false;
        LocalDateTime deadline = localDateTime(row.get("afterSaleDeadlineAt"));
        return deadline != null && deadline.isBefore(LocalDateTime.now());
    }

    private List<Map<String, Object>> afterSaleProgress(Map<String, Object> detail) {
        String type = normalizeAfterSaleType(detail.get("afterSaleType"));
        String status = normalizeAfterSaleStatus(detail.get("afterSaleStatus"));
        List<Map<String, Object>> steps = new ArrayList<>();
        steps.add(row("key", "APPLY", "title", "提交申请", "time", detail.get("createdAt")));
        steps.add(row("key", "REVIEW", "title", "后台审核", "time", firstPresent(detail.get("reviewedAt"), detail.get("updatedAt"))));
        if ("REJECTED".equals(status)) {
            steps.add(row("key", "REJECTED", "title", "已拒绝", "time", firstPresent(detail.get("reviewedAt"), detail.get("updatedAt"))));
        } else if ("CLOSED".equals(status)) {
            steps.add(row("key", "CLOSED", "title", "已关闭", "time", firstPresent(detail.get("closedAt"), detail.get("updatedAt"))));
        } else {
            if ("RETURN_REFUND".equals(type)) {
                steps.add(row("key", "BUYER_RETURN", "title", "买家退货", "time", returnLogisticsTime(longValue(detail.get("id")))));
                steps.add(row("key", "SELLER_RECEIVE", "title", "商家收货", "time", detail.get("receivedAt")));
            }
            steps.add(row("key", "REFUND", "title", "退款处理", "time", detail.get("refundedAt")));
            steps.add(row("key", "DONE", "title", "售后完成", "time", "COMPLETED".equals(status) ? detail.get("updatedAt") : null));
        }
        int current = switch (status) {
            case "PENDING_REVIEW" -> 1;
            case "WAIT_BUYER_RETURN" -> 2;
            case "WAIT_SELLER_RECEIVE" -> 3;
            case "WAIT_REFUND" -> "RETURN_REFUND".equals(type) ? 4 : 2;
            case "COMPLETED", "REJECTED", "CLOSED" -> steps.size() - 1;
            default -> 0;
        };
        for (int i = 0; i < steps.size(); i++) {
            steps.get(i).put("nodeStatus", i < current ? "DONE" : i == current ? "CURRENT" : "TODO");
        }
        if ("REJECTED".equals(status) || "CLOSED".equals(status)) {
            steps.get(steps.size() - 1).put("nodeStatus", "ABNORMAL");
        }
        return steps;
    }

    private Object returnLogisticsTime(Long afterSaleId) {
        return jdbcClient.sql("""
            SELECT COALESCE(shipped_at, created_at)
            FROM after_sale_return_logistics
            WHERE after_sale_id = :id
            ORDER BY id DESC
            LIMIT 1
            """)
            .param("id", afterSaleId)
            .query(Object.class)
            .optional()
            .orElse(null);
    }

    private Map<String, Object> afterSaleOrderInfo(String orderNo) {
        List<Map<String, Object>> rows = rows("""
            SELECT o.id, o.order_no, o.order_status, o.payment_status, o.fulfillment_status,
                   o.total_amount AS order_amount, o.total_amount AS paid_amount,
                   COALESCE(o.refunded_amount, 0) AS refunded_amount,
                   GREATEST(o.total_amount - COALESCE(o.refunded_amount, 0), 0) AS refundable_amount,
                   CASE
                     WHEN EXISTS (SELECT 1 FROM invoice_applies i WHERE i.order_no = o.order_no AND i.invoice_status = 'INVOICED') THEN 'INVOICED'
                     WHEN EXISTS (SELECT 1 FROM invoice_applies i WHERE i.order_no = o.order_no AND i.invoice_status = 'WAIT_INVOICE') THEN 'WAIT_INVOICE'
                     WHEN EXISTS (SELECT 1 FROM invoice_applies i WHERE i.order_no = o.order_no) THEN 'APPLIED'
                     ELSE 'NONE'
                   END AS invoice_status
            FROM sales_orders o
            WHERE o.order_no = :orderNo
            """, "orderNo", orderNo);
        return rows.isEmpty() ? row() : rows.get(0);
    }

    private Map<String, Object> afterSaleProductInfo(Map<String, Object> detail) {
        int purchasedQuantity = orderItemQuantity(string(detail.get("orderNo")), longObject(detail.get("productId")), string(detail.get("skuCode")));
        int history = afterSaleQuantity(string(detail.get("orderNo")), longObject(detail.get("productId")), string(detail.get("skuCode"))) - intValue(detail.get("applyQuantity"), 0);
        return row(
            "productId", detail.get("productId"),
            "productImage", detail.get("productImage"),
            "productName", detail.get("productName"),
            "skuCode", detail.get("skuCode"),
            "skuName", detail.get("skuName"),
            "purchaseQuantity", purchasedQuantity,
            "shippedQuantity", orderItemShippedQuantity(string(detail.get("orderNo")), longObject(detail.get("productId")), string(detail.get("skuCode"))),
            "afterSaleQuantity", Math.max(0, history),
            "applyQuantity", detail.get("applyQuantity"),
            "unitPrice", purchasedQuantity > 0 ? decimalValue(detail.get("applyAmount"), BigDecimal.ZERO).divide(BigDecimal.valueOf(Math.max(1, intValue(detail.get("applyQuantity"), 1))), 2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO,
            "applyAmount", detail.get("applyAmount")
        );
    }

    private Map<String, Object> afterSaleApplicationInfo(Map<String, Object> detail) {
        return row(
            "reason", detail.get("reason"),
            "description", detail.get("description"),
            "applyQuantity", detail.get("applyQuantity"),
            "applyAmount", detail.get("applyAmount"),
            "credentials", parseJsonList(detail.get("credentialUrls")),
            "emptyText", "买家未上传凭证"
        );
    }

    private Map<String, Object> afterSaleAuditInfo(Map<String, Object> detail) {
        if (detail.get("reviewedAt") == null && string(detail.get("auditRemark")).isBlank()) {
            return row("emptyText", "暂无审核信息");
        }
        return row(
            "reviewResult", "REJECTED".equals(detail.get("afterSaleStatus")) ? "REJECT" : "APPROVE",
            "processType", firstPresent(detail.get("processType"), detail.get("afterSaleType")),
            "approvedAmount", detail.get("approvedAmount"),
            "needReturn", detail.get("needReturn"),
            "returnAddress", detail.get("returnAddress"),
            "rejectReason", detail.get("rejectReason"),
            "remark", detail.get("auditRemark"),
            "operatorName", detail.get("reviewerName"),
            "reviewedAt", detail.get("reviewedAt")
        );
    }

    private List<Map<String, Object>> returnLogistics(Long afterSaleId) {
        return rows("""
            SELECT id, logistics_company, logistics_no, shipped_at AS return_shipped_at, remark AS return_remark, created_at
            FROM after_sale_return_logistics
            WHERE after_sale_id = :id
            ORDER BY id DESC
            """, "id", afterSaleId);
    }

    private Map<String, Object> afterSaleRefundInfo(Map<String, Object> detail) {
        if (!"REFUNDED".equals(normalizeRefundStatus(detail.get("refundStatus"))) && detail.get("refundedAt") == null) {
            return row("emptyText", "暂无退款信息", "refundStatus", detail.get("refundStatus"));
        }
        return row(
            "refundStatus", detail.get("refundStatus"),
            "refundMethod", detail.get("refundMethod"),
            "refundAmount", firstPresent(detail.get("refundAmount"), detail.get("approvedAmount")),
            "refundedAt", detail.get("refundedAt"),
            "refundNo", detail.get("refundNo"),
            "operatorName", detail.get("refundOperatorName"),
            "remark", detail.get("refundRemark"),
            "failedReason", null
        );
    }

    private Map<String, Object> afterSaleInvoiceImpact(String orderNo) {
        Map<String, Object> order = afterSaleOrderInfo(orderNo);
        BigDecimal paid = decimalValue(order.get("paidAmount"), BigDecimal.ZERO);
        BigDecimal refunded = decimalValue(order.get("refundedAmount"), BigDecimal.ZERO);
        String invoiceStatus = string(order.getOrDefault("invoiceStatus", "NONE"));
        boolean processing = activeAfterSaleCount(orderNo) > 0;
        BigDecimal invoiceable = paid.subtract(refunded).max(BigDecimal.ZERO);
        String tip = "";
        if (processing) tip = "售后处理中，订单不允许申请开票";
        if (refunded.compareTo(BigDecimal.ZERO) > 0 && "INVOICED".equals(invoiceStatus)) tip = "已开票订单发生退款，后续需处理红冲";
        if (invoiceable.compareTo(BigDecimal.ZERO) <= 0) tip = "订单已全额退款，不允许开票";
        return row(
            "invoiceStatus", invoiceStatus,
            "originalInvoiceableAmount", paid,
            "invoiceableAmount", invoiceable,
            "forbidInvoice", processing || invoiceable.compareTo(BigDecimal.ZERO) <= 0,
            "tip", tip
        );
    }

    private Map<String, Object> afterSaleInventoryImpact(Map<String, Object> detail) {
        return row(
            "needReturnInbound", "RETURN_REFUND".equals(normalizeAfterSaleType(firstPresent(detail.get("processType"), detail.get("afterSaleType")))),
            "inboundQuantity", detail.get("receivedQuantity"),
            "inboundTime", detail.get("receivedAt"),
            "relatedBizNo", detail.get("afterSaleNo"),
            "returnToStock", detail.get("returnToStock"),
            "remark", detail.get("receiveRemark")
        );
    }

    private List<Map<String, Object>> afterSaleLogs(String afterSaleNo, Long afterSaleId, Long orderId) {
        List<String> relatedNos = new ArrayList<>();
        relatedNos.add(afterSaleNo);
        relatedNos.add(String.valueOf(afterSaleId));
        if (orderId != null) relatedNos.add(String.valueOf(orderId));
        return rows("""
            SELECT id, created_at, operator_name, operation_name AS operation_type, operation_content
            FROM operation_logs
            WHERE related_no IN (:relatedNos)
            ORDER BY id DESC
            """, Map.of("relatedNos", relatedNos));
    }

    private Map<String, Object> findOrderItem(String orderNo, Map<String, Object> request, String productName) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("orderNo", orderNo);
        List<String> conditions = new ArrayList<>();
        Long productId = longObject(request.get("productId"));
        if (productId != null) {
            params.put("productId", productId);
            conditions.add("i.product_id = :productId");
        }
        String skuCode = string(request.get("skuCode")).trim();
        if (!skuCode.isBlank()) {
            params.put("skuCode", skuCode);
            conditions.add("i.sku_code = :skuCode");
        }
        if (conditions.isEmpty()) {
            params.put("productName", productName);
            conditions.add("i.product_name = :productName");
        }
        List<Map<String, Object>> items = rows("""
            SELECT i.id, i.order_id, i.product_id, i.product_name, i.sku_code, i.sku_name, i.quantity, i.shipped_quantity,
                   i.unit_price, i.line_amount, p.main_image_thumbnail_url, p.main_image_card_url,
                   CASE WHEN LOWER(COALESCE(p.main_image_url, '')) LIKE 'data:image%' THEN '' ELSE p.main_image_url END AS main_image_url
            FROM sales_order_items i
            JOIN sales_orders o ON o.id = i.order_id
            LEFT JOIN products p ON p.id = i.product_id
            WHERE o.order_no = :orderNo AND """ + String.join(" AND ", conditions) + """
            ORDER BY i.id
            LIMIT 1
            """, params);
        if (!items.isEmpty()) return items.get(0);
        return row("productId", productId, "productName", productName, "skuCode", skuCode, "skuName", request.get("skuName"), "quantity", 999999, "shippedQuantity", 0);
    }

    private int afterSaleQuantity(String orderNo, Long productId, String skuCode) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("orderNo", orderNo);
        StringBuilder sql = new StringBuilder("""
            SELECT COALESCE(SUM(quantity), 0)
            FROM after_sale_orders
            WHERE order_no = :orderNo
              AND after_sale_status NOT IN ('REJECTED','CLOSED','CANCELLED')
            """);
        if (productId != null) {
            sql.append(" AND product_id = :productId");
            params.put("productId", productId);
        }
        if (!string(skuCode).isBlank()) {
            sql.append(" AND sku_code = :skuCode");
            params.put("skuCode", skuCode);
        }
        Integer total = jdbcClient.sql(sql.toString()).params(params).query(Integer.class).single();
        return total == null ? 0 : total;
    }

    private int orderItemQuantity(String orderNo, Long productId, String skuCode) {
        return orderItemInt(orderNo, productId, skuCode, "quantity");
    }

    private int orderItemShippedQuantity(String orderNo, Long productId, String skuCode) {
        return orderItemInt(orderNo, productId, skuCode, "shipped_quantity");
    }

    private int orderItemInt(String orderNo, Long productId, String skuCode, String column) {
        if (!Set.of("quantity", "shipped_quantity").contains(column)) return 0;
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("orderNo", orderNo);
        StringBuilder sql = new StringBuilder("SELECT COALESCE(MAX(i." + column + "), 0) FROM sales_order_items i JOIN sales_orders o ON o.id = i.order_id WHERE o.order_no = :orderNo");
        if (productId != null) {
            sql.append(" AND i.product_id = :productId");
            params.put("productId", productId);
        }
        if (!string(skuCode).isBlank()) {
            sql.append(" AND i.sku_code = :skuCode");
            params.put("skuCode", skuCode);
        }
        Integer value = jdbcClient.sql(sql.toString()).params(params).query(Integer.class).single();
        return value == null ? 0 : value;
    }

    private void requireAfterSaleStatus(Map<String, Object> current, String allowed) {
        String actual = normalizeAfterSaleStatus(current.get("afterSaleStatus"));
        if (!actual.equals(allowed)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "当前售后状态不允许该操作");
        }
    }

    private void syncOrderRefund(String orderNo, BigDecimal refundAmount) {
        Map<String, Object> order = one("SELECT id, total_amount, COALESCE(refunded_amount, 0) AS refunded_amount FROM sales_orders WHERE order_no = :orderNo", "orderNo", orderNo);
        BigDecimal total = decimalValue(order.get("totalAmount"), BigDecimal.ZERO);
        BigDecimal nextRefunded = decimalValue(order.get("refundedAmount"), BigDecimal.ZERO).add(refundAmount).min(total);
        String paymentStatus = nextRefunded.compareTo(total) >= 0 ? "REFUNDED" : nextRefunded.compareTo(BigDecimal.ZERO) > 0 ? "PART_REFUNDED" : "PAID";
        jdbcClient.sql("""
            UPDATE sales_orders
            SET refunded_amount = :refundedAmount,
                payment_status = :paymentStatus
            WHERE order_no = :orderNo
            """)
            .param("refundedAmount", nextRefunded)
            .param("paymentStatus", paymentStatus)
            .param("orderNo", orderNo)
            .update();
    }

    private long activeAfterSaleCount(String orderNo) {
        Long count = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM after_sale_orders
            WHERE order_no = :orderNo
              AND after_sale_status NOT IN ('COMPLETED','REJECTED','CLOSED','CANCELLED')
            """)
            .param("orderNo", orderNo)
            .query(Long.class)
            .single();
        return count == null ? 0 : count;
    }

    private LocalDateTime localDateTime(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDateTime localDateTime) return localDateTime;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toLocalDateTime();
        try {
            return LocalDateTime.parse(string(value).replace(" ", "T").substring(0, 19));
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private BigDecimal decimalValue(Object value, BigDecimal fallback) {
        if (value == null || string(value).isBlank()) return fallback;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (RuntimeException exception) {
            return fallback;
        }
    }

    private Long longObject(Object value) {
        if (value == null || string(value).isBlank()) return null;
        try {
            return number(value).longValue();
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private Object firstPresent(Object... values) {
        for (Object value : values) {
            if (value != null && !string(value).isBlank()) return value;
        }
        return null;
    }

    private String safeImage(Object value) {
        String text = string(value).trim();
        return text.toLowerCase().startsWith("data:image") ? "" : text;
    }

    private String jsonText(Object value) {
        if (value == null) return "";
        if (value instanceof String text) return text;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return "";
        }
    }

    private List<Object> parseJsonList(Object value) {
        if (value instanceof List<?> list) return new ArrayList<>(list);
        String raw = string(value).trim();
        if (raw.isBlank()) return List.of();
        try {
            Object parsed = objectMapper.readValue(raw, Object.class);
            return parsed instanceof List<?> list ? new ArrayList<>(list) : List.of();
        } catch (JsonProcessingException exception) {
            return List.of();
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

    private String adminOrderWhere(
        String tab,
        String keyword,
        String orderStatus,
        String paymentStatus,
        String fulfillmentStatus,
        String startDate,
        String endDate,
        Map<String, Object> params
    ) {
        List<String> conditions = new ArrayList<>();
        String normalizedTab = string(tab).trim().toUpperCase();
        switch (normalizedTab) {
            case "UNPAID", "WAIT_PAY", "PENDING_PAYMENT" ->
                conditions.add("(o.payment_status = 'UNPAID' OR o.order_status IN ('WAIT_PAY','PENDING_PAYMENT'))");
            case "PENDING_SHIPMENT", "WAIT_SHIP" ->
                conditions.add("(o.order_status NOT IN ('CANCELLED','COMPLETED') AND o.fulfillment_status = 'UNSHIPPED' AND (o.payment_status IN ('PAID','NOT_REQUIRED_BEFORE_RECEIPT') OR o.order_status IN ('WAIT_SHIP','PENDING_SHIPMENT')))");
            case "PART_SHIPPED", "PARTIAL_SHIPPED" ->
                conditions.add("(o.fulfillment_status IN ('PART_SHIPPED','PARTIAL_SHIPPED') OR o.order_status IN ('PART_SHIPPED','PARTIAL_SHIPPED'))");
            case "PENDING_RECEIVE", "WAIT_RECEIVE", "SHIPPED" ->
                conditions.add("(o.order_status IN ('WAIT_RECEIVE','SHIPPED') OR o.fulfillment_status IN ('SHIPPED','NO_LOGISTICS'))");
            case "COMPLETED" -> conditions.add("o.order_status = 'COMPLETED'");
            case "CANCELLED" -> conditions.add("o.order_status = 'CANCELLED'");
            case "AFTER_SALE" ->
                conditions.add("(o.payment_status <> 'UNPAID' AND o.order_status NOT IN ('WAIT_PAY','PENDING_PAYMENT','CANCELLED') AND EXISTS (SELECT 1 FROM after_sale_orders a WHERE a.order_no = o.order_no AND a.after_sale_status NOT IN ('COMPLETED','REJECTED','CLOSED','CANCELLED')))");
            case "INVOICE_PENDING", "WAIT_INVOICE" ->
                conditions.add("EXISTS (SELECT 1 FROM invoice_applies i WHERE i.order_no = o.order_no AND i.invoice_status = 'WAIT_INVOICE')");
            default -> {
            }
        }
        String normalizedOrderStatus = string(orderStatus).trim().toUpperCase();
        if (!normalizedOrderStatus.isBlank()) {
            switch (normalizedOrderStatus) {
                case "WAIT_PAY", "PENDING_PAYMENT" ->
                    conditions.add("(o.order_status IN ('WAIT_PAY','PENDING_PAYMENT') OR o.payment_status = 'UNPAID')");
                case "WAIT_SHIP", "PENDING_SHIPMENT" ->
                    conditions.add("(o.order_status IN ('WAIT_SHIP','PENDING_SHIPMENT') OR (o.payment_status IN ('PAID','NOT_REQUIRED_BEFORE_RECEIPT') AND o.fulfillment_status = 'UNSHIPPED'))");
                case "WAIT_RECEIVE", "SHIPPED" ->
                    conditions.add("(o.order_status IN ('WAIT_RECEIVE','SHIPPED') OR o.fulfillment_status IN ('SHIPPED','NO_LOGISTICS'))");
                case "COMPLETED" -> conditions.add("o.order_status = 'COMPLETED'");
                case "CANCELLED" -> conditions.add("o.order_status = 'CANCELLED'");
                default -> {
                    params.put("orderStatus", normalizedOrderStatus);
                    conditions.add("o.order_status = :orderStatus");
                }
            }
        }
        String normalizedPaymentStatus = string(paymentStatus).trim().toUpperCase();
        if (!normalizedPaymentStatus.isBlank()) {
            if ("PART_REFUNDED".equals(normalizedPaymentStatus)) {
                conditions.add("o.payment_status IN ('PART_REFUNDED','PARTIAL_REFUNDED')");
            } else {
                params.put("paymentStatus", normalizedPaymentStatus);
                conditions.add("o.payment_status = :paymentStatus");
            }
        }
        String normalizedFulfillmentStatus = string(fulfillmentStatus).trim().toUpperCase();
        if (!normalizedFulfillmentStatus.isBlank()) {
            if ("PART_SHIPPED".equals(normalizedFulfillmentStatus)) {
                conditions.add("o.fulfillment_status IN ('PART_SHIPPED','PARTIAL_SHIPPED')");
            } else {
                params.put("fulfillmentStatus", normalizedFulfillmentStatus);
                conditions.add("o.fulfillment_status = :fulfillmentStatus");
            }
        }
        String keywordValue = string(keyword).trim();
        if (!keywordValue.isBlank()) {
            params.put("keyword", "%" + keywordValue + "%");
            conditions.add("(o.order_no LIKE :keyword OR o.customer_name LIKE :keyword OR o.receiver_name LIKE :keyword OR o.receiver_phone LIKE :keyword)");
        }
        String startDateValue = string(startDate).trim();
        if (!startDateValue.isBlank()) {
            params.put("startDate", startDateValue);
            conditions.add("o.created_at >= :startDate");
        }
        String endDateValue = string(endDate).trim();
        if (!endDateValue.isBlank()) {
            params.put("endDate", endDateValue);
            conditions.add("o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)");
        }
        return conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
    }

    private void attachOrderItems(List<Map<String, Object>> orders) {
        List<Long> orderIds = orders.stream()
            .map(item -> item.get("id"))
            .filter(Number.class::isInstance)
            .map(Number.class::cast)
            .map(Number::longValue)
            .toList();
        if (orderIds.isEmpty()) {
            orders.forEach(order -> order.put("items", List.of()));
            return;
        }
        List<Map<String, Object>> items = rows("""
            SELECT i.id, i.order_id, i.product_id, i.product_name, i.sku_code, i.sku_name, i.unit,
                   i.quantity, i.shipped_quantity, i.unit_price, i.line_amount,
                   p.main_image_thumbnail_url, p.main_image_card_url,
                   CASE WHEN p.main_image_url LIKE 'data:image%' THEN '' ELSE p.main_image_url END AS main_image_url
            FROM sales_order_items i
            LEFT JOIN products p ON p.id = i.product_id
            WHERE i.order_id IN (:orderIds)
            ORDER BY i.id
            """, Map.of("orderIds", orderIds));
        Map<Long, List<Map<String, Object>>> itemsByOrder = new LinkedHashMap<>();
        for (Map<String, Object> item : items) {
            Long orderId = ((Number) item.get("orderId")).longValue();
            item.put("afterSaleQuantity", 0);
            itemsByOrder.computeIfAbsent(orderId, ignored -> new ArrayList<>()).add(item);
        }
        for (Map<String, Object> order : orders) {
            Object rawId = order.get("id");
            Long orderId = rawId instanceof Number number ? number.longValue() : null;
            order.put("items", orderId == null ? List.of() : itemsByOrder.getOrDefault(orderId, List.of()));
        }
    }

    private List<Map<String, Object>> orderAfterSales(String orderNo) {
        return rows("""
            SELECT id, after_sale_no, order_no, buyer_name, after_sale_type AS type, product_name,
                   quantity, refund_amount AS amount, after_sale_status AS status, reason, audit_remark, refund_status, created_at, updated_at
            FROM after_sale_orders
            WHERE order_no = :orderNo
            ORDER BY id DESC
            """, "orderNo", orderNo);
    }

    private Map<String, Object> orderInvoice(String orderNo) {
        List<Map<String, Object>> invoices = rows("""
            SELECT id, invoice_apply_no, order_no, buyer_name, invoice_type, title_type,
                   invoice_title AS title, tax_no, apply_amount AS amount, receive_email,
                   invoice_status AS status, invoice_no, reject_reason, created_at, updated_at
            FROM invoice_applies
            WHERE order_no = :orderNo
            ORDER BY id DESC
            LIMIT 1
            """, "orderNo", orderNo);
        if (invoices.isEmpty()) {
            return null;
        }
        Map<String, Object> invoice = invoices.get(0);
        Object id = invoice.get("id");
        invoice.put("files", id instanceof Number number ? invoiceFiles(number.longValue()) : List.of());
        return invoice;
    }

    private List<Map<String, Object>> orderLogs(Long orderId, String orderNo) {
        return rows("""
            SELECT id, log_no, operator_name, module_name, operation_name AS operation_type,
                   operation_content AS operation_content, operation_result, created_at
            FROM operation_logs
            WHERE related_no = :orderNo OR related_no = :orderId
            ORDER BY id DESC
            """, Map.of("orderNo", orderNo, "orderId", String.valueOf(orderId)));
    }

    private Object orderLogTime(List<Map<String, Object>> logs, List<String> operationNames) {
        for (Map<String, Object> log : logs) {
            String operation = string(log.get("operationType"));
            if (operationNames.contains(operation)) {
                return log.get("createdAt");
            }
        }
        return null;
    }

    private List<Map<String, Object>> optionalOrderRows(Supplier<List<Map<String, Object>>> supplier) {
        try {
            return supplier.get();
        } catch (BadSqlGrammarException exception) {
            return List.of();
        }
    }

    private Map<String, Object> optionalOrderMap(Supplier<Map<String, Object>> supplier) {
        try {
            return supplier.get();
        } catch (BadSqlGrammarException exception) {
            return null;
        }
    }

    private boolean orderAllowsAfterSale(Map<String, Object> order) {
        String orderStatus = string(order.get("orderStatus")).toUpperCase();
        String paymentStatus = string(order.get("paymentStatus")).toUpperCase();
        return !"UNPAID".equals(paymentStatus)
            && !List.of("WAIT_PAY", "PENDING_PAYMENT", "CANCELLED").contains(orderStatus);
    }

    private long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return 0;
        }
        return Long.parseLong(String.valueOf(value));
    }

    private List<Map<String, Object>> rows(String sql) {
        return jdbcClient.sql(sql).query(this::mapRow).list();
    }

    private List<Map<String, Object>> rows(String sql, Map<String, ?> params) {
        return jdbcClient.sql(sql)
            .params(params)
            .query(this::mapRow)
            .list();
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

    private void validateAdminOperator(String operatorName) {
        long operatorExists = jdbcClient.sql("SELECT COUNT(*) FROM admin_accounts WHERE account_name = :accountName")
            .param("accountName", operatorName)
            .query(Long.class)
            .single();
        if (operatorExists == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "operatorName must be an existing admin account");
        }
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

    private void logAs(String operatorName, String module, String operation, String relatedNo, String content) {
        String logNo = "LOG" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
        jdbcClient.sql("""
            INSERT INTO operation_logs (log_no, operator_name, module_name, operation_name, related_no, operation_content, operation_result)
            VALUES (:logNo, :operatorName, :module, :operation, :relatedNo, :content, 'SUCCESS')
            """)
            .param("logNo", logNo)
            .param("operatorName", operatorName)
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
