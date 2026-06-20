package com.erp.b2b.product;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ProductSearchCodeBackfill implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ProductSearchCodeBackfill.class);

    private final JdbcClient jdbcClient;
    private final ProductSearchCodeGenerator generator;

    public ProductSearchCodeBackfill(JdbcClient jdbcClient, ProductSearchCodeGenerator generator) {
        this.jdbcClient = jdbcClient;
        this.generator = generator;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<ProductNameRow> products = jdbcClient.sql("""
            SELECT id, product_name
            FROM products
            WHERE COALESCE(pinyin_code, '') = ''
               OR COALESCE(pinyin_full, '') = ''
               OR COALESCE(initial_code, '') = ''
            """)
            .query((rs, rowNum) -> new ProductNameRow(rs.getLong("id"), rs.getString("product_name")))
            .list();

        int updated = 0;
        for (ProductNameRow product : products) {
            ProductSearchCodeGenerator.SearchCodes codes = generator.generate(product.productName());
            updated += jdbcClient.sql("""
                UPDATE products
                SET pinyin_code = CASE WHEN COALESCE(pinyin_code, '') = '' THEN :pinyinCode ELSE pinyin_code END,
                    pinyin_full = CASE WHEN COALESCE(pinyin_full, '') = '' THEN :pinyinFull ELSE pinyin_full END,
                    initial_code = CASE WHEN COALESCE(initial_code, '') = '' THEN :initialCode ELSE initial_code END
                WHERE id = :productId
                """)
                .param("productId", product.id())
                .param("pinyinCode", codes.pinyinCode())
                .param("pinyinFull", codes.pinyinFull())
                .param("initialCode", codes.initialCode())
                .update();
        }

        if (updated > 0) {
            log.info("Backfilled search codes for {} products", updated);
        }
    }

    private record ProductNameRow(Long id, String productName) {
    }
}
