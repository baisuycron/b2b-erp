package com.erp.b2b.customer;

import com.erp.b2b.common.ApiException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class CustomerRepository {
    private final JdbcClient jdbcClient;

    public CustomerRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<Customer> findAll() {
        return jdbcClient.sql("""
            SELECT id, customer_code, company_name, contact_name, contact_phone, address, audit_status,
                   CASE WHEN audit_status = 'DISABLED' THEN 'DISABLED' ELSE 'ENABLED' END AS status,
                   salesman_name, created_at, updated_at
            FROM customers
            ORDER BY id DESC
            """)
            .query(this::mapCustomer)
            .list();
    }

    public Optional<Customer> findById(Long id) {
        return jdbcClient.sql("""
            SELECT id, customer_code, company_name, contact_name, contact_phone, address, audit_status,
                   CASE WHEN audit_status = 'DISABLED' THEN 'DISABLED' ELSE 'ENABLED' END AS status,
                   salesman_name, created_at, updated_at
            FROM customers
            WHERE id = :id
            """)
            .param("id", id)
            .query(this::mapCustomer)
            .optional();
    }

    public boolean existsByPhone(String phone) {
        return existsByPhoneExceptId(phone, null);
    }

    public boolean existsByPhoneExceptId(String phone, Long id) {
        String normalizedPhone = normalizedText(phone);
        String idFilter = id == null ? "" : " AND id <> :id";
        var spec = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM customers
            WHERE (contact_phone = :phone OR login_phone = :phone)
            """ + idFilter)
            .param("phone", normalizedPhone);
        if (id != null) {
            spec = spec.param("id", id);
        }
        Long count = spec.query(Long.class).single();
        return count != null && count > 0;
    }

    public boolean existsByContactPhone(String contactPhone) {
        return existsByPhone(contactPhone);
    }

    public boolean existsByContactPhoneExceptId(String contactPhone, Long id) {
        return existsByPhoneExceptId(contactPhone, id);
    }

    public Map<String, Object> page(Map<String, String> request) {
        int page = Math.max(1, intParam(request.get("page"), 1));
        int pageSize = Math.min(50, Math.max(10, intParam(request.get("pageSize"), 10)));
        int offset = (page - 1) * pageSize;
        Map<String, Object> params = new LinkedHashMap<>();
        String where = customerWhere(request, params);
        Long total = jdbcClient.sql("SELECT COUNT(*) FROM customers c " + where)
            .params(params)
            .query(Long.class)
            .single();
        params.put("limit", pageSize);
        params.put("offset", offset);
        List<Map<String, Object>> list = jdbcClient.sql("""
            SELECT c.id, c.customer_code, c.company_name, c.contact_name, c.contact_phone,
                   c.login_phone, c.address, c.audit_status,
                   CASE WHEN c.audit_status = 'DISABLED' THEN 'DISABLED' ELSE 'ENABLED' END AS status,
                   c.salesman_name, c.remark, c.last_login_at, c.password_updated_at,
                   c.register_source, c.disabled_reason, c.disabled_remark, c.disabled_by, c.disabled_at,
                   c.created_at, c.updated_at,
                   COALESCE(o.order_count, 0) AS order_count,
                   COALESCE(o.total_paid_amount, 0) AS total_paid_amount,
                   COALESCE(a.total_refund_amount, 0) AS total_refund_amount,
                   o.last_order_time
            FROM customers c
            LEFT JOIN (
              SELECT customer_id, COUNT(*) AS order_count,
                     COALESCE(SUM(CASE WHEN payment_status <> 'UNPAID' THEN total_amount ELSE 0 END), 0) AS total_paid_amount,
                     MAX(created_at) AS last_order_time
              FROM sales_orders
              GROUP BY customer_id
            ) o ON o.customer_id = c.id
            LEFT JOIN (
              SELECT so.customer_id, COALESCE(SUM(aso.refund_amount), 0) AS total_refund_amount
              FROM after_sale_orders aso
              JOIN sales_orders so ON so.order_no = aso.order_no
              WHERE aso.refund_status IN ('SUCCESS','REFUNDED')
              GROUP BY so.customer_id
            ) a ON a.customer_id = c.id
            """ + where + """
            ORDER BY c.id DESC
            LIMIT :limit OFFSET :offset
            """)
            .params(params)
            .query(this::mapRow)
            .list();
        return Map.of(
            "list", list,
            "total", total == null ? 0 : total,
            "page", page,
            "pageSize", pageSize
        );
    }

    public Map<String, Object> detail(Long customerId) {
        Map<String, Object> basicInfo = one("""
            SELECT id, customer_code, company_name, contact_name, contact_phone, login_phone, address,
                   audit_status, CASE WHEN audit_status = 'DISABLED' THEN 'DISABLED' ELSE 'ENABLED' END AS status,
                   salesman_name, remark, created_at, updated_at
            FROM customers
            WHERE id = :id
            """, "id", customerId);
        Map<String, Object> accountInfo = one("""
            SELECT id, login_phone, CASE WHEN audit_status = 'DISABLED' THEN 'DISABLED' ELSE 'ENABLED' END AS status,
                   last_login_at, password_updated_at, register_source, disabled_reason, disabled_remark,
                   disabled_by, disabled_at, enabled_by, enabled_at
            FROM customers
            WHERE id = :id
            """, "id", customerId);
        return Map.of(
            "basicInfo", basicInfo,
            "accountInfo", accountInfo,
            "addresses", rows("""
                SELECT id, receiver_name, receiver_phone, region, detail_address, is_default, created_at, updated_at
                FROM customer_addresses
                WHERE customer_id = :id
                ORDER BY is_default DESC, id DESC
                """, "id", customerId),
            "invoiceTitles", rows("""
                SELECT id, title_type, invoice_title, tax_no, supported_invoice_types, default_invoice_type,
                       receive_email AS email, is_default, created_at, updated_at
                FROM invoice_titles
                WHERE customer_id = :id
                ORDER BY is_default DESC, id DESC
                """, "id", customerId),
            "orders", rows("""
                SELECT id, order_no, order_status, payment_status, fulfillment_status, total_amount,
                       CASE WHEN payment_status <> 'UNPAID' THEN total_amount ELSE 0 END AS paid_amount,
                       created_at
                FROM sales_orders
                WHERE customer_id = :id
                ORDER BY id DESC
                LIMIT 10
                """, "id", customerId),
            "afterSales", rows("""
                SELECT aso.id, aso.after_sale_no, aso.order_no, aso.after_sale_type, aso.after_sale_status,
                       aso.refund_amount, aso.refund_status, aso.created_at
                FROM after_sale_orders aso
                JOIN sales_orders so ON so.order_no = aso.order_no
                WHERE so.customer_id = :id
                ORDER BY aso.id DESC
                LIMIT 10
                """, "id", customerId),
            "invoices", rows("""
                SELECT ia.id, ia.invoice_apply_no, ia.order_no, ia.invoice_type, ia.invoice_title,
                       ia.apply_amount, ia.invoice_status, ia.created_at
                FROM invoice_applies ia
                LEFT JOIN sales_orders so ON so.order_no = ia.order_no
                WHERE so.customer_id = :id OR ia.buyer_name = (SELECT company_name FROM customers WHERE id = :id)
                ORDER BY ia.id DESC
                LIMIT 10
                """, "id", customerId),
            "logs", rows("""
                SELECT id, operator_type, operator_name, action_type, action_content, created_at
                FROM customer_operation_logs
                WHERE customer_id = :id
                ORDER BY id DESC
                LIMIT 50
                """, "id", customerId)
        );
    }

    public Customer create(CreateCustomerRequest request, String customerCode) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        String phone = normalizedText(firstPresent(request.loginPhone(), request.contactPhone()));
        jdbcClient.sql("""
            INSERT INTO customers (
              customer_code, company_name, contact_name, contact_phone, login_phone, password_hash,
              password_updated_at, address, audit_status, salesman_name, register_source, remark
            )
            VALUES (
              :customerCode, :companyName, :contactName, :contactPhone, :loginPhone, :passwordHash,
              NOW(), :address, 'APPROVED', :salesmanName, 'ADMIN', :remark
            )
            """)
            .param("customerCode", customerCode)
            .param("companyName", request.companyName().trim())
            .param("contactName", request.contactName().trim())
            .param("contactPhone", normalizedText(request.contactPhone()))
            .param("loginPhone", phone)
            .param("passwordHash", passwordHash(request.password()))
            .param("address", normalizedText(request.address()))
            .param("salesmanName", normalizedText(request.salesmanName()))
            .param("remark", normalizedText(request.remark()))
            .update(keyHolder, "id");
        Long id = keyHolder.getKey().longValue();
        logCustomer(id, "ADMIN", normalizedText(request.operatorName()), "CUSTOMER_CREATE", "后台新增买家");
        return findById(id).orElseThrow();
    }

    public Customer update(Long id, CreateCustomerRequest request) {
        ensureExists(id);
        jdbcClient.sql("""
            UPDATE customers
            SET company_name = :companyName,
                contact_name = :contactName,
                contact_phone = :contactPhone,
                login_phone = :loginPhone,
                address = :address,
                salesman_name = :salesmanName,
                remark = :remark
            WHERE id = :id
            """)
            .param("companyName", request.companyName().trim())
            .param("contactName", request.contactName().trim())
            .param("contactPhone", normalizedText(request.contactPhone()))
            .param("loginPhone", normalizedText(firstPresent(request.loginPhone(), request.contactPhone())))
            .param("address", normalizedText(request.address()))
            .param("salesmanName", normalizedText(request.salesmanName()))
            .param("remark", normalizedText(request.remark()))
            .param("id", id)
            .update();
        logCustomer(id, "ADMIN", normalizedText(request.operatorName()), "CUSTOMER_UPDATE", "编辑买家基础信息");
        return findById(id).orElseThrow();
    }

    public Customer updateStatus(Long id, String status, String reason, String remark, String operatorName) {
        ensureExists(id);
        String auditStatus = "DISABLED".equalsIgnoreCase(status) ? "DISABLED" : "APPROVED";
        if ("DISABLED".equals(auditStatus)) {
            jdbcClient.sql("""
                UPDATE customers
                SET audit_status = 'DISABLED',
                    disabled_reason = :reason,
                    disabled_remark = :remark,
                    disabled_by = :operatorName,
                    disabled_at = NOW()
                WHERE id = :id AND audit_status <> 'DISABLED'
                """)
                .param("reason", normalizedText(reason))
                .param("remark", normalizedText(remark))
                .param("operatorName", operatorName)
                .param("id", id)
                .update();
            logCustomer(id, "ADMIN", operatorName, "CUSTOMER_DISABLE", "停用买家：" + normalizedText(reason));
        } else {
            jdbcClient.sql("""
                UPDATE customers
                SET audit_status = 'APPROVED',
                    enabled_by = :operatorName,
                    enabled_at = NOW(),
                    disabled_reason = NULL,
                    disabled_remark = NULL
                WHERE id = :id AND audit_status = 'DISABLED'
                """)
                .param("operatorName", operatorName)
                .param("id", id)
                .update();
            logCustomer(id, "ADMIN", operatorName, "CUSTOMER_ENABLE", "启用买家：" + normalizedText(remark));
        }
        return findById(id).orElseThrow();
    }

    public void resetPassword(Long id, String password, String remark, String operatorName) {
        ensureExists(id);
        jdbcClient.sql("""
            UPDATE customers
            SET password_hash = :passwordHash,
                password_updated_at = NOW()
            WHERE id = :id
            """)
            .param("passwordHash", passwordHash(password))
            .param("id", id)
            .update();
        logCustomer(id, "ADMIN", operatorName, "PASSWORD_RESET", "后台重置密码：" + normalizedText(remark));
    }

    public Customer updateStatus(Long id, String status) {
        return updateStatus(id, status, "", "", "SYSTEM");
    }

    public void logCustomer(Long customerId, String operatorType, String operatorName, String actionType, String content) {
        jdbcClient.sql("""
            INSERT INTO customer_operation_logs (customer_id, operator_type, operator_name, action_type, action_content)
            VALUES (:customerId, :operatorType, :operatorName, :actionType, :content)
            """)
            .param("customerId", customerId)
            .param("operatorType", operatorType)
            .param("operatorName", operatorName == null || operatorName.isBlank() ? "SYSTEM" : operatorName)
            .param("actionType", actionType)
            .param("content", content == null || content.isBlank() ? actionType : content)
            .update();
    }

    public static String passwordHash(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(password.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    public static String nextCustomerCode() {
        return "CUST-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
    }

    private String customerWhere(Map<String, String> request, Map<String, Object> params) {
        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        String tab = normalizedText(request.get("tab")).toUpperCase();
        if ("ENABLED".equals(tab)) {
            where.append(" AND c.audit_status <> 'DISABLED' ");
        } else if ("DISABLED".equals(tab)) {
            where.append(" AND c.audit_status = 'DISABLED' ");
        }
        String status = normalizedText(request.get("status")).toUpperCase();
        if ("ENABLED".equals(status)) {
            where.append(" AND c.audit_status <> 'DISABLED' ");
        } else if ("DISABLED".equals(status)) {
            where.append(" AND c.audit_status = 'DISABLED' ");
        }
        String keyword = normalizedText(request.get("keyword"));
        if (!keyword.isBlank()) {
            where.append("""
                AND (c.customer_code LIKE :keyword OR c.company_name LIKE :keyword OR c.contact_name LIKE :keyword
                     OR c.contact_phone LIKE :keyword OR c.login_phone LIKE :keyword)
                """);
            params.put("keyword", "%" + keyword + "%");
        }
        String salesmanName = normalizedText(request.get("salesmanName"));
        if (!salesmanName.isBlank()) {
            where.append(" AND c.salesman_name LIKE :salesmanName ");
            params.put("salesmanName", "%" + salesmanName + "%");
        }
        String startDate = normalizedText(request.get("startDate"));
        if (!startDate.isBlank()) {
            where.append(" AND c.created_at >= :startDate ");
            params.put("startDate", startDate + " 00:00:00");
        }
        String endDate = normalizedText(request.get("endDate"));
        if (!endDate.isBlank()) {
            where.append(" AND c.created_at <= :endDate ");
            params.put("endDate", endDate + " 23:59:59");
        }
        String hasOrder = normalizedText(request.get("hasOrder")).toUpperCase();
        if ("YES".equals(hasOrder) || "TRUE".equals(hasOrder)) {
            where.append(" AND EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id) ");
        } else if ("NO".equals(hasOrder) || "FALSE".equals(hasOrder)) {
            where.append(" AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = c.id) ");
        }
        return where.toString();
    }

    private Customer mapCustomer(ResultSet rs, int rowNum) throws SQLException {
        return new Customer(
            rs.getLong("id"),
            rs.getString("customer_code"),
            rs.getString("company_name"),
            rs.getString("contact_name"),
            rs.getString("contact_phone"),
            rs.getString("address"),
            rs.getString("audit_status"),
            rs.getString("status"),
            rs.getString("salesman_name"),
            rs.getTimestamp("created_at").toLocalDateTime(),
            rs.getTimestamp("updated_at").toLocalDateTime()
        );
    }

    private List<Map<String, Object>> rows(String sql, String paramName, Object value) {
        return jdbcClient.sql(sql).param(paramName, value).query(this::mapRow).list();
    }

    private Map<String, Object> one(String sql, String paramName, Object value) {
        return jdbcClient.sql(sql)
            .param(paramName, value)
            .query(this::mapRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "买家不存在"));
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

    private void ensureExists(Long id) {
        Long count = jdbcClient.sql("SELECT COUNT(*) FROM customers WHERE id = :id")
            .param("id", id)
            .query(Long.class)
            .single();
        if (count == null || count == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "买家不存在");
        }
    }

    private int intParam(String value, int fallback) {
        try {
            return value == null || value.isBlank() ? fallback : Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private String normalizedText(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstPresent(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }
}
