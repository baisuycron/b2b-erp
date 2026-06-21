package com.erp.b2b.product;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class ProductThumbnailService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProductThumbnailService.class);
    private static final int THUMBNAIL_SIZE = 120;
    private static final int CARD_SIZE = 400;
    private static final int MAX_IMAGE_BYTES = 12 * 1024 * 1024;
    private static final String DATA_IMAGE_PREFIX = "data:image";

    private final JdbcClient jdbcClient;
    private final Path thumbnailDirectory;
    private final String thumbnailUrlPrefix;
    private final Path imageDirectory;
    private final String imageUrlPrefix;

    public ProductThumbnailService(
        JdbcClient jdbcClient,
        @Value("${b2b.product-thumbnail.directory}") String thumbnailDirectory,
        @Value("${b2b.product-thumbnail.url-prefix:/api/public/product-thumbnails}") String thumbnailUrlPrefix,
        @Value("${b2b.product-image.directory}") String imageDirectory,
        @Value("${b2b.product-image.url-prefix:/api/public/product-images}") String imageUrlPrefix
    ) {
        this.jdbcClient = jdbcClient;
        Path configuredDirectory = Path.of(thumbnailDirectory);
        this.thumbnailDirectory = (configuredDirectory.isAbsolute()
            ? configuredDirectory
            : Path.of(System.getProperty("user.home")).resolve(configuredDirectory))
            .toAbsolutePath()
            .normalize();
        this.thumbnailUrlPrefix = thumbnailUrlPrefix.replaceAll("/+$", "");
        Path configuredImageDirectory = Path.of(imageDirectory);
        this.imageDirectory = (configuredImageDirectory.isAbsolute()
            ? configuredImageDirectory
            : Path.of(System.getProperty("user.home")).resolve(configuredImageDirectory))
            .toAbsolutePath()
            .normalize();
        this.imageUrlPrefix = imageUrlPrefix.replaceAll("/+$", "");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void backfillExistingThumbnails() {
        List<ImageSource> sources = jdbcClient.sql("""
            SELECT id, main_image_url
            FROM products
            WHERE (COALESCE(main_image_thumbnail_url, '') = ''
                OR COALESCE(main_image_card_url, '') = '')
              AND COALESCE(main_image_url, '') <> ''
            """)
            .query(this::mapImageSource)
            .list();
        sources.forEach(this::safelyRefreshAndStore);
    }

    public void refreshAndStore(Product product) {
        if (product == null || product.id() == null) return;
        safelyRefreshAndStore(new ImageSource(product.id(), product.mainImageUrl()));
    }

    public Path resolveThumbnail(String filename) {
        if (filename == null || !filename.matches("[0-9]+-[0-9a-f]{16}(?:-(?:thumb|card))?\\.jpg")) return null;
        Path resolved = thumbnailDirectory.resolve(filename).normalize();
        return resolved.startsWith(thumbnailDirectory) ? resolved : null;
    }

    private void safelyRefreshAndStore(ImageSource source) {
        try {
            GeneratedImages images = createImageUrls(source);
            jdbcClient.sql("""
                UPDATE products
                SET main_image_thumbnail_url = :thumbnailUrl,
                    main_image_card_url = :cardUrl
                WHERE id = :id
                """)
                .param("thumbnailUrl", images.thumbnailUrl())
                .param("cardUrl", images.cardUrl())
                .param("id", source.id())
                .update();
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to create product thumbnail for product {}", source.id(), exception);
        }
    }

    private GeneratedImages createImageUrls(ImageSource source) {
        String imageUrl = source.mainImageUrl() == null ? "" : source.mainImageUrl().trim();
        if (imageUrl.isBlank()) return new GeneratedImages("", "");
        if (!imageUrl.toLowerCase(Locale.ROOT).startsWith(DATA_IMAGE_PREFIX)) {
            GeneratedImages generatedFromStoredImage = createFromStoredProductImageUrl(source.id(), imageUrl);
            if (!generatedFromStoredImage.isEmpty()) return generatedFromStoredImage;
            String safeUrl = isGeneratedImageUrl(imageUrl) ? imageUrl : "";
            return new GeneratedImages(safeUrl, isCardUrl(imageUrl) ? imageUrl : "");
        }

        int commaIndex = imageUrl.indexOf(',');
        if (commaIndex < 0 || !imageUrl.substring(0, commaIndex).toLowerCase(Locale.ROOT).contains(";base64")) {
            return new GeneratedImages("", "");
        }

        try {
            byte[] sourceBytes = Base64.getDecoder().decode(imageUrl.substring(commaIndex + 1).replaceAll("\\s+", ""));
            if (sourceBytes.length == 0 || sourceBytes.length > MAX_IMAGE_BYTES) return new GeneratedImages("", "");
            BufferedImage sourceImage = ImageIO.read(new ByteArrayInputStream(sourceBytes));
            if (sourceImage == null) return new GeneratedImages("", "");

            Files.createDirectories(thumbnailDirectory);
            String hash = contentHash(sourceBytes);
            String thumbnailUrl = writeSizedImage(source.id(), hash, "thumb", THUMBNAIL_SIZE, sourceImage);
            String cardUrl = writeSizedImage(source.id(), hash, "card", CARD_SIZE, sourceImage);
            return new GeneratedImages(thumbnailUrl, cardUrl);
        } catch (IllegalArgumentException | IOException exception) {
            return new GeneratedImages("", "");
        }
    }

    private GeneratedImages createFromStoredProductImageUrl(Long productId, String imageUrl) {
        String normalizedPrefix = imageUrlPrefix.toLowerCase(Locale.ROOT) + "/";
        if (!imageUrl.toLowerCase(Locale.ROOT).startsWith(normalizedPrefix)) {
            return new GeneratedImages("", "");
        }

        String filename = imageUrl.substring(imageUrlPrefix.length() + 1);
        if (!filename.matches("[0-9]+-[0-9a-f]{24}\\.(jpg|jpeg|png|gif|webp)")) {
            return new GeneratedImages("", "");
        }

        Path source = imageDirectory.resolve(filename).normalize();
        if (!source.startsWith(imageDirectory) || !Files.isRegularFile(source)) {
            return new GeneratedImages("", "");
        }

        try {
            long size = Files.size(source);
            if (size == 0 || size > MAX_IMAGE_BYTES) return new GeneratedImages("", "");
            byte[] sourceBytes = Files.readAllBytes(source);
            BufferedImage sourceImage = ImageIO.read(new ByteArrayInputStream(sourceBytes));
            if (sourceImage == null) return new GeneratedImages("", "");

            Files.createDirectories(thumbnailDirectory);
            String hash = contentHash(sourceBytes);
            String thumbnailUrl = writeSizedImage(productId, hash, "thumb", THUMBNAIL_SIZE, sourceImage);
            String cardUrl = writeSizedImage(productId, hash, "card", CARD_SIZE, sourceImage);
            return new GeneratedImages(thumbnailUrl, cardUrl);
        } catch (IOException exception) {
            return new GeneratedImages("", "");
        }
    }

    private String writeSizedImage(Long productId, String hash, String role, int size, BufferedImage sourceImage) throws IOException {
        int sourceWidth = Math.max(1, sourceImage.getWidth());
        int sourceHeight = Math.max(1, sourceImage.getHeight());
        double scale = Math.min((double) size / sourceWidth, (double) size / sourceHeight);
        int width = Math.max(1, (int) Math.round(sourceWidth * scale));
        int height = Math.max(1, (int) Math.round(sourceHeight * scale));
        int x = (size - width) / 2;
        int y = (size - height) / 2;

        BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, size, size);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(sourceImage, x, y, width, height, null);
        } finally {
            graphics.dispose();
        }

        String filename = productId + "-" + hash + "-" + role + ".jpg";
        Path target = thumbnailDirectory.resolve(filename).normalize();
        if (!target.startsWith(thumbnailDirectory)) return "";
        if (!Files.exists(target)) ImageIO.write(image, "jpg", target.toFile());
        return thumbnailUrlPrefix + "/" + filename;
    }

    private boolean isGeneratedImageUrl(String imageUrl) {
        String normalized = imageUrl.toLowerCase(Locale.ROOT);
        return normalized.startsWith(thumbnailUrlPrefix.toLowerCase(Locale.ROOT) + "/")
            || normalized.contains("/thumb/")
            || normalized.contains("/thumbnail/");
    }

    private boolean isCardUrl(String imageUrl) {
        String normalized = imageUrl.toLowerCase(Locale.ROOT);
        return normalized.startsWith(thumbnailUrlPrefix.toLowerCase(Locale.ROOT) + "/")
            && normalized.contains("-card.");
    }

    private String contentHash(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder result = new StringBuilder(16);
            for (int index = 0; index < 8; index++) result.append(String.format("%02x", digest[index]));
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private ImageSource mapImageSource(ResultSet resultSet, int rowNum) throws SQLException {
        return new ImageSource(
            resultSet.getLong("id"),
            resultSet.getString("main_image_url")
        );
    }

    private record ImageSource(Long id, String mainImageUrl) {
    }

    private record GeneratedImages(String thumbnailUrl, String cardUrl) {
        private boolean isEmpty() {
            return thumbnailUrl.isBlank() && cardUrl.isBlank();
        }
    }
}
