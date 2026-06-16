package com.erp.b2b.customer;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
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

    public boolean existsByContactPhone(String contactPhone) {
        String normalizedPhone = contactPhone.trim();
        Long count = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM customers
            WHERE contact_phone = :contactPhone
            """)
            .param("contactPhone", normalizedPhone)
            .query(Long.class)
            .single();
        return count != null && count > 0;
    }

    public boolean existsByContactPhoneExceptId(String contactPhone, Long id) {
        String normalizedPhone = contactPhone.trim();
        Long count = jdbcClient.sql("""
            SELECT COUNT(*)
            FROM customers
            WHERE contact_phone = :contactPhone
              AND id <> :id
            """)
            .param("contactPhone", normalizedPhone)
            .param("id", id)
            .query(Long.class)
            .single();
        return count != null && count > 0;
    }

    public Customer create(CreateCustomerRequest request, String customerCode) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("""
            INSERT INTO customers (customer_code, company_name, contact_name, contact_phone, address, audit_status, salesman_name)
            VALUES (:customerCode, :companyName, :contactName, :contactPhone, :address, 'APPROVED', :salesmanName)
            """)
            .param("customerCode", customerCode)
            .param("companyName", request.companyName().trim())
            .param("contactName", request.contactName().trim())
            .param("contactPhone", request.contactPhone().trim())
            .param("address", normalizedText(request.address()))
            .param("salesmanName", request.salesmanName())
            .update(keyHolder, "id");
        Long id = keyHolder.getKey().longValue();
        return findById(id).orElseThrow();
    }

    public Customer update(Long id, CreateCustomerRequest request) {
        jdbcClient.sql("""
            UPDATE customers
            SET company_name = :companyName,
                contact_name = :contactName,
                contact_phone = :contactPhone,
                address = :address
            WHERE id = :id
            """)
            .param("companyName", request.companyName().trim())
            .param("contactName", request.contactName().trim())
            .param("contactPhone", request.contactPhone().trim())
            .param("address", normalizedText(request.address()))
            .param("id", id)
            .update();
        return findById(id).orElseThrow();
    }

    public Customer updateStatus(Long id, String status) {
        String auditStatus = "DISABLED".equalsIgnoreCase(status) ? "DISABLED" : "APPROVED";
        jdbcClient.sql("""
            UPDATE customers
            SET audit_status = :auditStatus
            WHERE id = :id
            """)
            .param("auditStatus", auditStatus)
            .param("id", id)
            .update();
        return findById(id).orElseThrow();
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

    private String normalizedText(String value) {
        return value == null ? "" : value.trim();
    }
}
