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
            SELECT id, customer_code, company_name, contact_name, contact_phone, audit_status, salesman_name, created_at, updated_at
            FROM customers
            ORDER BY id DESC
            """)
            .query(this::mapCustomer)
            .list();
    }

    public Optional<Customer> findById(Long id) {
        return jdbcClient.sql("""
            SELECT id, customer_code, company_name, contact_name, contact_phone, audit_status, salesman_name, created_at, updated_at
            FROM customers
            WHERE id = :id
            """)
            .param("id", id)
            .query(this::mapCustomer)
            .optional();
    }

    public Customer create(CreateCustomerRequest request, String customerCode) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("""
            INSERT INTO customers (customer_code, company_name, contact_name, contact_phone, audit_status, salesman_name)
            VALUES (:customerCode, :companyName, :contactName, :contactPhone, 'APPROVED', :salesmanName)
            """)
            .param("customerCode", customerCode)
            .param("companyName", request.companyName())
            .param("contactName", request.contactName())
            .param("contactPhone", request.contactPhone())
            .param("salesmanName", request.salesmanName())
            .update(keyHolder, "id");
        Long id = keyHolder.getKey().longValue();
        return findById(id).orElseThrow();
    }

    private Customer mapCustomer(ResultSet rs, int rowNum) throws SQLException {
        return new Customer(
            rs.getLong("id"),
            rs.getString("customer_code"),
            rs.getString("company_name"),
            rs.getString("contact_name"),
            rs.getString("contact_phone"),
            rs.getString("audit_status"),
            rs.getString("salesman_name"),
            rs.getTimestamp("created_at").toLocalDateTime(),
            rs.getTimestamp("updated_at").toLocalDateTime()
        );
    }
}
