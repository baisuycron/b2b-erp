package com.erp.b2b.inventory;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class InventoryRepository {
    private final JdbcClient jdbcClient;

    public InventoryRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<InventoryMovement> findAll() {
        return jdbcClient.sql("""
            SELECT im.id, im.product_id, p.product_name, p.sku_code, im.movement_type,
                   im.quantity_delta, im.stock_after, im.source_type, im.source_no, im.remark, im.created_at
            FROM inventory_movements im
            JOIN products p ON p.id = im.product_id
            ORDER BY im.id DESC
            """)
            .query(this::mapMovement)
            .list();
    }

    public void insertMovement(Long productId, String movementType, int quantityDelta, int stockAfter, String sourceType, String sourceNo, String remark) {
        jdbcClient.sql("""
            INSERT INTO inventory_movements (product_id, movement_type, quantity_delta, stock_after, source_type, source_no, remark)
            VALUES (:productId, :movementType, :quantityDelta, :stockAfter, :sourceType, :sourceNo, :remark)
            """)
            .param("productId", productId)
            .param("movementType", movementType)
            .param("quantityDelta", quantityDelta)
            .param("stockAfter", stockAfter)
            .param("sourceType", sourceType)
            .param("sourceNo", sourceNo)
            .param("remark", remark)
            .update();
    }

    private InventoryMovement mapMovement(ResultSet rs, int rowNum) throws SQLException {
        return new InventoryMovement(
            rs.getLong("id"),
            rs.getLong("product_id"),
            rs.getString("product_name"),
            rs.getString("sku_code"),
            rs.getString("movement_type"),
            rs.getInt("quantity_delta"),
            rs.getInt("stock_after"),
            rs.getString("source_type"),
            rs.getString("source_no"),
            rs.getString("remark"),
            rs.getTimestamp("created_at").toLocalDateTime()
        );
    }
}
