package com.erp.b2b.product;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class ProductRepository {
    private final JdbcClient jdbcClient;

    public ProductRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<Product> findAll() {
        return jdbcClient.sql("""
            SELECT id, product_code, sku_code, product_name, sku_name, unit, sale_price, stock_quantity, min_order_quantity, sale_status, created_at, updated_at
            FROM products
            ORDER BY id DESC
            """)
            .query(this::mapProduct)
            .list();
    }

    public Optional<Product> findById(Long id) {
        return jdbcClient.sql("""
            SELECT id, product_code, sku_code, product_name, sku_name, unit, sale_price, stock_quantity, min_order_quantity, sale_status, created_at, updated_at
            FROM products
            WHERE id = :id
            """)
            .param("id", id)
            .query(this::mapProduct)
            .optional();
    }

    public Product create(CreateProductRequest request, String productCode, String skuCode) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("""
            INSERT INTO products (product_code, sku_code, product_name, sku_name, unit, sale_price, stock_quantity, min_order_quantity, sale_status)
            VALUES (:productCode, :skuCode, :productName, :skuName, :unit, :salePrice, :stockQuantity, :minOrderQuantity, 'ON_SALE')
            """)
            .param("productCode", productCode)
            .param("skuCode", skuCode)
            .param("productName", request.productName())
            .param("skuName", request.skuName())
            .param("unit", request.unit())
            .param("salePrice", request.salePrice())
            .param("stockQuantity", request.stockQuantity())
            .param("minOrderQuantity", request.minOrderQuantity())
            .update(keyHolder, "id");
        Long id = keyHolder.getKey().longValue();
        return findById(id).orElseThrow();
    }

    public int deductStock(Long productId, int quantity) {
        return jdbcClient.sql("""
            UPDATE products
            SET stock_quantity = stock_quantity - :quantity
            WHERE id = :productId
              AND sale_status = 'ON_SALE'
              AND stock_quantity >= :quantity
            """)
            .param("productId", productId)
            .param("quantity", quantity)
            .update();
    }

    public int addStock(Long productId, int quantity) {
        return jdbcClient.sql("""
            UPDATE products
            SET stock_quantity = stock_quantity + :quantity
            WHERE id = :productId
              AND :quantity > 0
            """)
            .param("productId", productId)
            .param("quantity", quantity)
            .update();
    }

    public int setSaleStatus(Long productId, String saleStatus) {
        return jdbcClient.sql("""
            UPDATE products
            SET sale_status = :saleStatus
            WHERE id = :productId
            """)
            .param("productId", productId)
            .param("saleStatus", saleStatus)
            .update();
    }

    private Product mapProduct(ResultSet rs, int rowNum) throws SQLException {
        return new Product(
            rs.getLong("id"),
            rs.getString("product_code"),
            rs.getString("sku_code"),
            rs.getString("product_name"),
            rs.getString("sku_name"),
            rs.getString("unit"),
            rs.getBigDecimal("sale_price"),
            rs.getInt("stock_quantity"),
            rs.getInt("min_order_quantity"),
            rs.getString("sale_status"),
            rs.getTimestamp("created_at").toLocalDateTime(),
            rs.getTimestamp("updated_at").toLocalDateTime()
        );
    }
}
