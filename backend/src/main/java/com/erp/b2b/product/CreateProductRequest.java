package com.erp.b2b.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record CreateProductRequest(
    @NotBlank(message = "商品名称不能为空")
    @Size(max = 30, message = "商品名称不能超过30个字符")
    String productName,
    @NotBlank(message = "单位不能为空")
    @Size(max = 10, message = "单位不能超过10个字符")
    String unit,
    @NotNull(message = "单价不能为空")
    @DecimalMin(value = "0.01", message = "单价必须大于0")
    @Digits(integer = 5, fraction = 2, message = "单价不能超过99999.99")
    BigDecimal salePrice,
    @NotNull(message = "库存不能为空")
    @Min(value = 1, message = "库存必须为正整数")
    @Max(value = 999999, message = "库存不能超过999999")
    Integer stockQuantity,
    @NotNull(message = "最小起订量不能为空")
    @Min(value = 1, message = "最小起订量不能小于1")
    @Max(value = 100, message = "最小起订量不能超过100")
    Integer minOrderQuantity,
    @Size(max = 18, message = "SKU编码不能超过18位")
    @Pattern(regexp = "^[0-9A-Za-z]*$", message = "SKU编码只能输入字母或数字")
    String skuCode,
    @Size(max = 18, message = "SKU条码不能超过18位")
    @Pattern(regexp = "^[0-9A-Za-z]*$", message = "SKU条码只能输入字母或数字")
    String skuBarcode,
    String categoryName,
    String brandName,
    Long attributeTemplateId,
    List<Map<String, Object>> customAttributes,
    String quoteType,
    String saleMode,
    String saleUnit,
    Integer saleUnitRatio,
    String saleStatus,
    String mainImageUrl,
    String detailContent,
    String skuStatus,
    String productStatus,
    List<Map<String, Object>> skuList,
    List<Map<String, Object>> tierPrices
) {
}
