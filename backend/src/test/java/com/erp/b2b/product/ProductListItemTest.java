package com.erp.b2b.product;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ProductListItemTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void serializesOnlyLightweightListFields() throws Exception {
        ProductListItem item = new ProductListItem(
            1L,
            "0000001",
            "BAR-1",
            "商品",
            "分类",
            "品牌",
            "规格",
            "件",
            "INDEPENDENT_PRICE",
            new BigDecimal("12.50"),
            8,
            "NORMAL",
            "ON_SALE",
            "/uploads/products/thumb/1.jpg",
            null
        );

        String json = objectMapper.writeValueAsString(item);

        assertThat(json).contains("mainImageThumbnailUrl");
        assertThat(json).doesNotContain("skuCode");
        assertThat(json).doesNotContain(
            "data:image",
            "detailContent",
            "skuListJson",
            "tierPricesJson",
            "skuList",
            "tierPrices"
        );
    }
}
