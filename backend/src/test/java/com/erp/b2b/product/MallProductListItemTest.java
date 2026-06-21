package com.erp.b2b.product;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class MallProductListItemTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void serializesOnlyMallListFields() throws Exception {
        MallProductListItem item = new MallProductListItem(
            1L,
            "0000001",
            "BAR-1",
            "Product",
            "Category",
            "Brand",
            "Default",
            "pcs",
            "INDEPENDENT_PRICE",
            "NORMAL",
            "",
            null,
            new BigDecimal("12.50"),
            8,
            1,
            "ON_SALE",
            "/api/public/product-thumbnails/1-card.jpg",
            "/api/public/product-thumbnails/1-thumb.jpg",
            null
        );

        String json = objectMapper.writeValueAsString(item);

        assertThat(json).contains("mainImageCardUrl");
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
