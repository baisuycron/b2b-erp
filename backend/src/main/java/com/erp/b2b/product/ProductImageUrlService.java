package com.erp.b2b.product;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ProductImageUrlService {
    private static final int MAX_IMAGE_BYTES = 12 * 1024 * 1024;
    private static final Pattern DATA_IMAGE_PATTERN = Pattern.compile("^data:image/([a-zA-Z0-9.+-]+);base64,(.+)$", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern HTML_IMG_SRC_PATTERN = Pattern.compile("(<img\\b[^>]*?\\bsrc=[\"'])(data:image/[^\"']+)([\"'][^>]*>)", Pattern.CASE_INSENSITIVE);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path imageDirectory;
    private final String imageUrlPrefix;

    public ProductImageUrlService(
        @Value("${b2b.product-image.directory}") String imageDirectory,
        @Value("${b2b.product-image.url-prefix:/api/public/product-images}") String imageUrlPrefix
    ) {
        Path configuredDirectory = Path.of(imageDirectory);
        this.imageDirectory = (configuredDirectory.isAbsolute()
            ? configuredDirectory
            : Path.of(System.getProperty("user.home")).resolve(configuredDirectory))
            .toAbsolutePath()
            .normalize();
        this.imageUrlPrefix = imageUrlPrefix.replaceAll("/+$", "");
    }

    public Path resolveImage(String filename) {
        if (filename == null || !filename.matches("[0-9]+-[0-9a-f]{24}\\.(jpg|jpeg|png|gif|webp)")) return null;
        Path resolved = imageDirectory.resolve(filename).normalize();
        return resolved.startsWith(imageDirectory) ? resolved : null;
    }

    public Map<String, Object> toDetailResponse(Product product, String mainImageThumbnailUrl) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", product.id());
        response.put("productCode", product.productCode());
        response.put("skuCode", product.skuCode());
        response.put("skuBarcode", product.skuBarcode());
        response.put("pinyinCode", product.pinyinCode());
        response.put("pinyinFull", product.pinyinFull());
        response.put("initialCode", product.initialCode());
        response.put("productName", product.productName());
        response.put("categoryName", product.categoryName());
        response.put("brandName", product.brandName());
        response.put("attributeTemplateId", product.attributeTemplateId());
        response.put("customAttributesJson", product.customAttributesJson());
        response.put("skuName", product.skuName());
        response.put("skuStatus", product.skuStatus());
        response.put("unit", product.unit());
        response.put("quoteType", product.quoteType());
        response.put("saleMode", product.saleMode());
        response.put("saleUnit", product.saleUnit());
        response.put("saleUnitRatio", product.saleUnitRatio());
        String mainImageUrl = sanitizeImageValue(product.mainImageUrl(), product.id(), "main");
        String thumbnailUrl = sanitizeImageValue(mainImageThumbnailUrl, product.id(), "thumb");
        response.put("mainImageUrl", mainImageUrl);
        response.put("mainImageThumbnailUrl", thumbnailUrl.isBlank() ? mainImageUrl : thumbnailUrl);
        response.put("detailContent", sanitizeJsonOrHtml(product.detailContent(), product.id(), "detail"));
        response.put("salePrice", product.salePrice());
        response.put("stockQuantity", product.stockQuantity());
        response.put("minOrderQuantity", product.minOrderQuantity());
        response.put("skuListJson", sanitizeJsonOrHtml(product.skuListJson(), product.id(), "sku"));
        response.put("tierPricesJson", product.tierPricesJson());
        response.put("saleStatus", product.saleStatus());
        response.put("createdAt", product.createdAt());
        response.put("updatedAt", product.updatedAt());
        response.put("carouselImages", collectCarouselImages(response.get("detailContent"), response.get("mainImageUrl")));
        response.put("detailImages", collectDetailImages(response.get("detailContent")));
        response.put("specImages", collectSpecImages(response.get("skuListJson")));
        return response;
    }

    public String sanitizeJsonOrHtml(String raw, Long productId, String role) {
        if (raw == null || raw.isBlank()) return raw;
        String trimmed = raw.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                Object parsed = objectMapper.readValue(raw, Object.class);
                Object sanitized = sanitizeValue(parsed, productId, role);
                return objectMapper.writeValueAsString(sanitized);
            } catch (JsonProcessingException ignored) {
                return sanitizeHtml(raw, productId, role);
            }
        }
        return sanitizeHtml(raw, productId, role);
    }

    private Object sanitizeValue(Object value, Long productId, String role) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), sanitizeValue(entry.getValue(), productId, role));
            }
            return result;
        }
        if (value instanceof List<?> list) {
            List<Object> result = new ArrayList<>();
            for (Object item : list) result.add(sanitizeValue(item, productId, role));
            return result;
        }
        if (value instanceof String text) {
            return sanitizeString(text, productId, role);
        }
        return value;
    }

    private String sanitizeString(String value, Long productId, String role) {
        String text = value.trim();
        if (text.toLowerCase(Locale.ROOT).startsWith("data:image/")) {
            return storeDataImage(text, productId, role);
        }
        if (text.toLowerCase(Locale.ROOT).contains("data:image/") && text.toLowerCase(Locale.ROOT).contains("<img")) {
            return sanitizeHtml(value, productId, role);
        }
        return value;
    }

    private String sanitizeImageValue(String value, Long productId, String role) {
        if (value == null || value.isBlank()) return "";
        return sanitizeString(value, productId, role);
    }

    private String sanitizeHtml(String html, Long productId, String role) {
        Matcher matcher = HTML_IMG_SRC_PATTERN.matcher(html);
        StringBuffer result = new StringBuffer();
        while (matcher.find()) {
            String url = storeDataImage(matcher.group(2), productId, role);
            matcher.appendReplacement(result, Matcher.quoteReplacement(matcher.group(1) + url + matcher.group(3)));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private String storeDataImage(String dataUrl, Long productId, String role) {
        Matcher matcher = DATA_IMAGE_PATTERN.matcher(dataUrl.trim());
        if (!matcher.matches()) return "";
        String extension = extension(matcher.group(1));
        try {
            byte[] bytes = Base64.getDecoder().decode(matcher.group(2).replaceAll("\\s+", ""));
            if (bytes.length == 0 || bytes.length > MAX_IMAGE_BYTES) return "";
            Files.createDirectories(imageDirectory);
            String filename = productId + "-" + hash(bytes) + "." + extension;
            Path target = imageDirectory.resolve(filename).normalize();
            if (!target.startsWith(imageDirectory)) return "";
            if (!Files.exists(target)) Files.write(target, bytes);
            return imageUrlPrefix + "/" + filename;
        } catch (IllegalArgumentException | IOException exception) {
            return "";
        }
    }

    private List<String> collectCarouselImages(Object detailContent, Object mainImageUrl) {
        Set<String> images = new LinkedHashSet<>();
        addUrl(images, mainImageUrl);
        Object parsed = readJson(detailContent);
        if (parsed instanceof Map<?, ?> map) collectImageValue(map.get("carouselImages"), images);
        return List.copyOf(images);
    }

    private List<String> collectDetailImages(Object detailContent) {
        Set<String> images = new LinkedHashSet<>();
        Object parsed = readJson(detailContent);
        if (parsed instanceof Map<?, ?> map) {
            collectImageValue(map.get("imageUrl"), images);
            collectImageValue(map.get("detailImageUrl"), images);
            collectHtmlImages(String.valueOf(map.get("html") == null ? "" : map.get("html")), images);
            collectHtmlImages(String.valueOf(map.get("text") == null ? "" : map.get("text")), images);
            collectHtmlImages(String.valueOf(map.get("detailText") == null ? "" : map.get("detailText")), images);
        } else {
            collectHtmlImages(String.valueOf(detailContent == null ? "" : detailContent), images);
        }
        return List.copyOf(images);
    }

    private List<String> collectSpecImages(Object skuListJson) {
        Set<String> images = new LinkedHashSet<>();
        collectImageValue(readJson(skuListJson), images);
        return List.copyOf(images);
    }

    private void collectImageValue(Object value, Set<String> images) {
        if (value instanceof String text) {
            if (looksLikeUrl(text)) addUrl(images, text);
            collectHtmlImages(text, images);
        } else if (value instanceof List<?> list) {
            for (Object item : list) collectImageValue(item, images);
        } else if (value instanceof Map<?, ?> map) {
            for (Object item : map.values()) collectImageValue(item, images);
        }
    }

    private void collectHtmlImages(String html, Set<String> images) {
        Matcher matcher = Pattern.compile("<img\\b[^>]*?\\bsrc=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE).matcher(html);
        while (matcher.find()) addUrl(images, matcher.group(1));
    }

    private void addUrl(Set<String> images, Object value) {
        String text = value == null ? "" : String.valueOf(value).trim();
        if (looksLikeUrl(text)) images.add(text);
    }

    private Object readJson(Object raw) {
        if (raw == null) return null;
        String text = String.valueOf(raw).trim();
        if (!text.startsWith("{") && !text.startsWith("[")) return null;
        try {
            return objectMapper.readValue(text, Object.class);
        } catch (JsonProcessingException ignored) {
            return null;
        }
    }

    private boolean looksLikeUrl(String value) {
        String text = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return !text.startsWith("data:image/") && (text.startsWith("/") || text.startsWith("http://") || text.startsWith("https://"));
    }

    private String extension(String imageType) {
        String normalized = imageType == null ? "" : imageType.toLowerCase(Locale.ROOT);
        if (normalized.contains("png")) return "png";
        if (normalized.contains("gif")) return "gif";
        if (normalized.contains("webp")) return "webp";
        return "jpg";
    }

    private String hash(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder result = new StringBuilder(24);
            for (int index = 0; index < 12; index++) result.append(String.format("%02x", digest[index]));
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
