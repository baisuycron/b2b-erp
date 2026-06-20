package com.erp.b2b.product;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProductSearchCodeGeneratorTest {
    private final ProductSearchCodeGenerator generator = new ProductSearchCodeGenerator();

    @Test
    void generatesFullPinyinAndInitialsForChineseProductName() {
        ProductSearchCodeGenerator.SearchCodes codes = generator.generate("可口可乐500ml");

        assertThat(codes.pinyinCode()).isEqualTo("kkkl500ml");
        assertThat(codes.pinyinFull()).isEqualTo("kekoukele500ml");
        assertThat(codes.initialCode()).isEqualTo("kkkl500ml");
    }

    @Test
    void ignoresSpacesAndPunctuation() {
        ProductSearchCodeGenerator.SearchCodes codes = generator.generate("景田 饮用纯净水-12瓶");

        assertThat(codes.pinyinCode()).isEqualTo("jtyycjs12p");
        assertThat(codes.pinyinFull()).isEqualTo("jingtianyinyongchunjingshui12ping");
        assertThat(codes.initialCode()).isEqualTo("jtyycjs12p");
    }
}
