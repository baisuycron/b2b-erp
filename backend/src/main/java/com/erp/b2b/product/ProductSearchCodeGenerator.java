package com.erp.b2b.product;

import java.util.Locale;
import net.sourceforge.pinyin4j.PinyinHelper;
import net.sourceforge.pinyin4j.format.HanyuPinyinCaseType;
import net.sourceforge.pinyin4j.format.HanyuPinyinOutputFormat;
import net.sourceforge.pinyin4j.format.HanyuPinyinToneType;
import net.sourceforge.pinyin4j.format.HanyuPinyinVCharType;
import net.sourceforge.pinyin4j.format.exception.BadHanyuPinyinOutputFormatCombination;
import org.springframework.stereotype.Component;

@Component
public class ProductSearchCodeGenerator {
    private static final int MAX_PINYIN_CODE_LENGTH = 120;
    private static final int MAX_PINYIN_FULL_LENGTH = 255;
    private static final int MAX_INITIAL_CODE_LENGTH = 80;

    private final HanyuPinyinOutputFormat format;

    public ProductSearchCodeGenerator() {
        format = new HanyuPinyinOutputFormat();
        format.setCaseType(HanyuPinyinCaseType.LOWERCASE);
        format.setToneType(HanyuPinyinToneType.WITHOUT_TONE);
        format.setVCharType(HanyuPinyinVCharType.WITH_V);
    }

    public SearchCodes generate(String productName) {
        String normalized = productName == null ? "" : productName.trim();
        StringBuilder full = new StringBuilder();
        StringBuilder initials = new StringBuilder();

        for (char character : normalized.toCharArray()) {
            String pinyin = firstPinyin(character);
            if (pinyin != null && !pinyin.isBlank()) {
                full.append(pinyin);
                initials.append(pinyin.charAt(0));
            } else if (Character.isLetterOrDigit(character)) {
                String text = String.valueOf(character).toLowerCase(Locale.ROOT);
                full.append(text);
                initials.append(text);
            }
        }

        String initialCode = truncate(initials.toString(), MAX_INITIAL_CODE_LENGTH);
        return new SearchCodes(
            truncate(initialCode, MAX_PINYIN_CODE_LENGTH),
            truncate(full.toString(), MAX_PINYIN_FULL_LENGTH),
            initialCode
        );
    }

    private String firstPinyin(char character) {
        try {
            String[] values = PinyinHelper.toHanyuPinyinStringArray(character, format);
            return values == null || values.length == 0 ? null : values[0];
        } catch (BadHanyuPinyinOutputFormatCombination ex) {
            throw new IllegalStateException("Invalid pinyin output format", ex);
        }
    }

    private String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    public record SearchCodes(String pinyinCode, String pinyinFull, String initialCode) {
    }
}
