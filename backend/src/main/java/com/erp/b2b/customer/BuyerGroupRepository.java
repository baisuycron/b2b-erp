package com.erp.b2b.customer;

import com.erp.b2b.common.ApiException;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BuyerGroupRepository {
    private final JdbcClient jdbcClient;

    public BuyerGroupRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Map<String, Object> page(Map<String, String> request) {
        int page = Math.max(1, intParam(request.get("page"), 1));
        int pageSize = Math.min(50, Math.max(10, intParam(request.get("pageSize"), 10)));
        int offset = (page - 1) * pageSize;
        Map<String, Object> params = new LinkedHashMap<>();
        String where = groupWhere(request, params);
        Long total = jdbcClient.sql("SELECT COUNT(*) FROM buyer_groups bg " + where)
            .params(params)
            .query(Long.class)
            .single();
        params.put("limit", pageSize);
        params.put("offset", offset);
        List<Map<String, Object>> list = jdbcClient.sql("""
            SELECT bg.id, bg.group_code, bg.group_name, bg.status, bg.sort_order, bg.remark, bg.is_default,
                   bg.created_by, bg.created_at, bg.updated_by, bg.updated_at,
                   COALESCE(c.buyer_count, 0) AS buyer_count
            FROM buyer_groups bg
            LEFT JOIN (
              SELECT group_id, COUNT(*) AS buyer_count
              FROM customers
              WHERE group_id IS NOT NULL
              GROUP BY group_id
            ) c ON c.group_id = bg.id
            """ + where + """
            ORDER BY bg.sort_order ASC, bg.id DESC
            LIMIT :limit OFFSET :offset
            """)
            .params(params)
            .query(this::mapRow)
            .list();
        return Map.of("list", list, "total", total == null ? 0 : total, "page", page, "pageSize", pageSize);
    }

    public List<Map<String, Object>> options() {
        return jdbcClient.sql("""
            SELECT id, group_code, group_name, is_default
            FROM buyer_groups
            WHERE status = 'ENABLED'
            ORDER BY is_default DESC, sort_order ASC, id DESC
            """)
            .query(this::mapRow)
            .list();
    }

    public Map<String, Object> create(Map<String, Object> request) {
        String groupName = required(request, "groupName");
        ensureUniqueName(groupName, null);
        String operatorName = required(request, "operatorName");
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        int sortOrder = nonNegativeInt(request.get("sortOrder"));
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("""
            INSERT INTO buyer_groups (group_code, group_name, status, sort_order, remark, created_by, updated_by)
            VALUES (:groupCode, :groupName, :status, :sortOrder, :remark, :operatorName, :operatorName)
            """)
            .param("groupCode", nextGroupCode())
            .param("groupName", groupName)
            .param("status", status)
            .param("sortOrder", sortOrder)
            .param("remark", optional(request.get("remark")))
            .param("operatorName", operatorName)
            .update(keyHolder, "id");
        return findById(keyHolder.getKey().longValue());
    }

    public Map<String, Object> update(Long groupId, Map<String, Object> request) {
        ensureExists(groupId);
        String groupName = required(request, "groupName");
        ensureUniqueName(groupName, groupId);
        String operatorName = required(request, "operatorName");
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        ensureDefaultGroupCanUseStatus(groupId, status);
        int sortOrder = nonNegativeInt(request.get("sortOrder"));
        jdbcClient.sql("""
            UPDATE buyer_groups
            SET group_name = :groupName,
                status = :status,
                sort_order = :sortOrder,
                remark = :remark,
                updated_by = :operatorName
            WHERE id = :id
            """)
            .param("groupName", groupName)
            .param("status", status)
            .param("sortOrder", sortOrder)
            .param("remark", optional(request.get("remark")))
            .param("operatorName", operatorName)
            .param("id", groupId)
            .update();
        return findById(groupId);
    }

    public Map<String, Object> updateStatus(Long groupId, Map<String, Object> request) {
        ensureExists(groupId);
        String operatorName = required(request, "operatorName");
        String status = normalizeStatus(request.getOrDefault("status", "ENABLED"));
        ensureDefaultGroupCanUseStatus(groupId, status);
        jdbcClient.sql("""
            UPDATE buyer_groups
            SET status = :status, updated_by = :operatorName
            WHERE id = :id
            """)
            .param("status", status)
            .param("operatorName", operatorName)
            .param("id", groupId)
            .update();
        return findById(groupId);
    }

    public void delete(Long groupId) {
        ensureExists(groupId);
        if (isDefaultGroup(groupId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "默认分组不能删除");
        }
        long buyerCount = buyerCount(groupId);
        if (buyerCount > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "当前分组下已有买家，不允许删除，请先移除买家后再删除。");
        }
        jdbcClient.sql("DELETE FROM buyer_groups WHERE id = :id")
            .param("id", groupId)
            .update();
    }

    public Map<String, Object> buyers(Long groupId, Map<String, String> request) {
        ensureExists(groupId);
        int page = Math.max(1, intParam(request.get("page"), 1));
        int pageSize = Math.min(50, Math.max(10, intParam(request.get("pageSize"), 10)));
        int offset = (page - 1) * pageSize;
        String keyword = optional(request.get("keyword"));
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("groupId", groupId);
        String keywordWhere = "";
        if (!keyword.isBlank()) {
            keywordWhere = """
                AND (c.customer_code LIKE :keyword OR c.company_name LIKE :keyword OR c.contact_name LIKE :keyword
                     OR c.contact_phone LIKE :keyword OR c.login_phone LIKE :keyword)
                """;
            params.put("keyword", "%" + keyword + "%");
        }
        Long total = jdbcClient.sql("SELECT COUNT(*) FROM customers c WHERE c.group_id = :groupId " + keywordWhere)
            .params(params)
            .query(Long.class)
            .single();
        params.put("limit", pageSize);
        params.put("offset", offset);
        List<Map<String, Object>> list = jdbcClient.sql("""
            SELECT c.id, c.customer_code, c.company_name, c.contact_name, c.contact_phone, c.login_phone,
                   CASE WHEN c.audit_status = 'DISABLED' THEN 'DISABLED' ELSE 'ENABLED' END AS status,
                   c.last_login_at, c.created_at,
                   COALESCE(o.order_count, 0) AS order_count,
                   COALESCE(o.total_paid_amount, 0) AS total_paid_amount,
                   o.last_order_time
            FROM customers c
            LEFT JOIN (
              SELECT customer_id, COUNT(*) AS order_count,
                     COALESCE(SUM(CASE WHEN payment_status <> 'UNPAID' THEN total_amount ELSE 0 END), 0) AS total_paid_amount,
                     MAX(created_at) AS last_order_time
              FROM sales_orders
              GROUP BY customer_id
            ) o ON o.customer_id = c.id
            WHERE c.group_id = :groupId
            """ + keywordWhere + """
            ORDER BY c.id DESC
            LIMIT :limit OFFSET :offset
            """)
            .params(params)
            .query(this::mapRow)
            .list();
        return Map.of("list", list, "total", total == null ? 0 : total, "page", page, "pageSize", pageSize);
    }

    @Transactional
    public void assignBuyers(Long groupId, Map<String, Object> request) {
        Map<String, Object> group = findById(groupId);
        if (!"ENABLED".equals(group.get("status"))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "分组已停用，不能继续分配买家");
        }
        String operatorName = required(request, "operatorName");
        List<Long> buyerIds = longList(request.get("buyerIds"));
        if (buyerIds.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请选择需要分配的买家");
        }
        Long existing = jdbcClient.sql("SELECT COUNT(*) FROM customers WHERE id IN (:ids)")
            .param("ids", buyerIds)
            .query(Long.class)
            .single();
        if (existing == null || existing != buyerIds.size()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "买家不存在");
        }
        jdbcClient.sql("UPDATE customers SET group_id = :groupId WHERE id IN (:ids)")
            .param("groupId", groupId)
            .param("ids", buyerIds)
            .update();
        buyerIds.forEach(id -> logCustomer(id, operatorName, "CUSTOMER_GROUP_ASSIGN", "分配到买家分组：" + group.get("groupName")));
    }

    public void removeBuyer(Long groupId, Long buyerId, String operatorName) {
        ensureExists(groupId);
        required(Map.of("operatorName", operatorName), "operatorName");
        Long count = jdbcClient.sql("SELECT COUNT(*) FROM customers WHERE id = :buyerId")
            .param("buyerId", buyerId)
            .query(Long.class)
            .single();
        if (count == null || count == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "买家不存在");
        }
        jdbcClient.sql("UPDATE customers SET group_id = :defaultGroupId WHERE id = :buyerId AND group_id = :groupId")
            .param("buyerId", buyerId)
            .param("groupId", groupId)
            .param("defaultGroupId", defaultGroupId())
            .update();
        logCustomer(buyerId, operatorName, "CUSTOMER_GROUP_REMOVE", "从买家分组移除");
    }

    private Map<String, Object> findById(Long groupId) {
        return jdbcClient.sql("""
            SELECT bg.id, bg.group_code, bg.group_name, bg.status, bg.sort_order, bg.remark, bg.is_default,
                   bg.created_by, bg.created_at, bg.updated_by, bg.updated_at,
                   COALESCE(c.buyer_count, 0) AS buyer_count
            FROM buyer_groups bg
            LEFT JOIN (
              SELECT group_id, COUNT(*) AS buyer_count
              FROM customers
              WHERE group_id IS NOT NULL
              GROUP BY group_id
            ) c ON c.group_id = bg.id
            WHERE bg.id = :id
            """)
            .param("id", groupId)
            .query(this::mapRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "买家分组不存在"));
    }

    private String groupWhere(Map<String, String> request, Map<String, Object> params) {
        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        String keyword = optional(request.get("keyword"));
        if (!keyword.isBlank()) {
            where.append(" AND (bg.group_code LIKE :keyword OR bg.group_name LIKE :keyword) ");
            params.put("keyword", "%" + keyword + "%");
        }
        String status = normalizeStatus(request.getOrDefault("status", ""));
        if ("ENABLED".equals(status) || "DISABLED".equals(status)) {
            where.append(" AND bg.status = :status ");
            params.put("status", status);
        }
        return where.toString();
    }

    private void ensureUniqueName(String groupName, Long id) {
        String idFilter = id == null ? "" : " AND id <> :id";
        var spec = jdbcClient.sql("SELECT COUNT(*) FROM buyer_groups WHERE group_name = :groupName" + idFilter)
            .param("groupName", groupName);
        if (id != null) {
            spec = spec.param("id", id);
        }
        Long count = spec.query(Long.class).single();
        if (count != null && count > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "分组名称不能重复");
        }
    }

    private void ensureExists(Long groupId) {
        Long count = jdbcClient.sql("SELECT COUNT(*) FROM buyer_groups WHERE id = :id")
            .param("id", groupId)
            .query(Long.class)
            .single();
        if (count == null || count == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "买家分组不存在");
        }
    }

    private void ensureDefaultGroupCanUseStatus(Long groupId, String status) {
        if (isDefaultGroup(groupId) && "DISABLED".equals(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "默认分组不能停用");
        }
    }

    private boolean isDefaultGroup(Long groupId) {
        Long count = jdbcClient.sql("SELECT COUNT(*) FROM buyer_groups WHERE id = :id AND is_default = true")
            .param("id", groupId)
            .query(Long.class)
            .single();
        return count != null && count > 0;
    }

    private Long defaultGroupId() {
        return jdbcClient.sql("""
            SELECT id
            FROM buyer_groups
            WHERE is_default = true
            ORDER BY id ASC
            LIMIT 1
            """)
            .query(Long.class)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "默认分组不存在"));
    }

    private long buyerCount(Long groupId) {
        Long count = jdbcClient.sql("SELECT COUNT(*) FROM customers WHERE group_id = :groupId")
            .param("groupId", groupId)
            .query(Long.class)
            .single();
        return count == null ? 0 : count;
    }

    private void logCustomer(Long customerId, String operatorName, String actionType, String content) {
        jdbcClient.sql("""
            INSERT INTO customer_operation_logs (customer_id, operator_type, operator_name, action_type, action_content)
            VALUES (:customerId, 'ADMIN', :operatorName, :actionType, :content)
            """)
            .param("customerId", customerId)
            .param("operatorName", operatorName)
            .param("actionType", actionType)
            .param("content", content)
            .update();
    }

    private String required(Map<String, Object> request, String key) {
        String value = optional(request.get(key));
        if (value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, key + "不能为空");
        }
        return value;
    }

    private String normalizeStatus(Object value) {
        String status = optional(value).toUpperCase();
        if ("启用".equals(value) || "ON".equals(status)) return "ENABLED";
        if ("停用".equals(value) || "OFF".equals(status)) return "DISABLED";
        if (status.isBlank() || "ALL".equals(status)) return "";
        if (!List.of("ENABLED", "DISABLED").contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "状态值不正确");
        }
        return status;
    }

    private int nonNegativeInt(Object value) {
        int result = intParam(optional(value), 0);
        if (result < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "排序必须为非负整数");
        }
        return result;
    }

    private List<Long> longList(Object value) {
        if (!(value instanceof List<?> values)) return List.of();
        List<Long> result = new ArrayList<>();
        for (Object item : values) {
            try {
                result.add(Long.parseLong(optional(item)));
            } catch (NumberFormatException ignored) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "buyerIds 参数不正确");
            }
        }
        return result.stream().distinct().toList();
    }

    private String nextGroupCode() {
        return "BG" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + System.currentTimeMillis() % 100000;
    }

    private int intParam(String value, int fallback) {
        try {
            return value == null || value.isBlank() ? fallback : Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private String optional(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
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
}
