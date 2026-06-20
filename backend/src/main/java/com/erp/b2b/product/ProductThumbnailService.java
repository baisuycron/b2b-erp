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
    private static final int MAX_IMAGE_BYTES = 12 * 1024 * 1024;
    private static final String DATA_IMAGE_PREFIX = "data:image";

    private final JdbcClient jdbcClient;
    private final Path thumbnailDirectory;
    private final String thumbnailUrlPrefix;

    public ProductThumbnailService(
        JdbcClient jdbcClient,
        @Value("${b2b.product-thumbnail.directory}") String thumbnailDirectory,
        @Value("${b2b.product-thumbnail.url-prefix:/api/public/product-thumbnails}") String thumbnailUrlPrefix
    ) {
        this.jdbcClient = jdbcClient;
        Path configuredDirectory = Path.of(thumbnailDirectory);
        this.thumbnailDirectory = (configuredDirectory.isAbsolute()
            ? configuredDirectory
            : Path.of(System.getProperty("user.home")).resolve(configuredDirectory))
            .toAbsolutePath()
            .normalize();
        this.thumbnailUrlPrefix = thumbnailUrlPrefix.replaceAll("/+$", "");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void backfillExistingThumbnails() {
        List<ImageSource> sources = jdbcClient.sql("""
            SELECT id, main_image_url
            FROM products
            WHERE COALESCE(main_image_thumbnail_url, '') = ''
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
        if (filename == null || !filename.matches("[0-9]+-[0-9a-f]{16}\\.jpg")) return null;
        Path resolved = thumbnailDirectory.resolve(filename).normalize();
        return resolved.startsWith(thumbnailDirectory) ? resolved : null;
    }

    private void safelyRefreshAndStore(ImageSource source) {
        try {
            String thumbnailUrl = createThumbnailUrl(source);
            jdbcClient.sql("""
                UPDATE products
                SET main_image_thumbnail_url = :thumbnailUrl
                WHERE id = :id
                """)
                .param("thumbnailUrl", thumbnailUrl)
                .param("id", source.id())
                .update();
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to create product thumbnail for product {}", source.id(), exception);
        }
    }

    private String createThumbnailUrl(ImageSource source) {
        String imageUrl = source.mainImageUrl() == null ? "" : source.mainImageUrl().trim();
        if (imageUrl.isBlank()) return "";
        if (!imageUrl.toLowerCase(Locale.ROOT).startsWith(DATA_IMAGE_PREFIX)) {
            return isThumbnailUrl(imageUrl) ? imageUrl : "";
        }

        int commaIndex = imageUrl.indexOf(',');
        if (commaIndex < 0 || !imageUrl.substring(0, commaIndex).toLowerCase(Locale.ROOT).contains(";base64")) {
            return "";
        }

        try {
            byte[] sourceBytes = Base64.getDecoder().decode(imageUrl.substring(commaIndex + 1).replaceAll("\\s+", ""));
            if (sourceBytes.length == 0 || sourceBytes.length > MAX_IMAGE_BYTES) return "";
            BufferedImage sourceImage = ImageIO.read(new ByteArrayInputStream(sourceBytes));
            if (sourceImage == null) return "";

            int sourceWidth = Math.max(1, sourceImage.getWidth());
            int sourceHeight = Math.max(1, sourceImage.getHeight());
            double scale = Math.min((double) THUMBNAIL_SIZE / sourceWidth, (double) THUMBNAIL_SIZE / sourceHeight);
            int width = Math.max(1, (int) Math.round(sourceWidth * scale));
            int height = Math.max(1, (int) Math.round(sourceHeight * scale));
            int x = (THUMBNAIL_SIZE - width) / 2;
            int y = (THUMBNAIL_SIZE - height) / 2;

            BufferedImage thumbnail = new BufferedImage(THUMBNAIL_SIZE, THUMBNAIL_SIZE, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = thumbnail.createGraphics();
            try {
                graphics.setColor(Color.WHITE);
                graphics.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                graphics.drawImage(sourceImage, x, y, width, height, null);
            } finally {
                graphics.dispose();
            }

            Files.createDirectories(thumbnailDirectory);
            String filename = source.id() + "-" + contentHash(sourceBytes) + ".jpg";
            Path target = thumbnailDirectory.resolve(filename).normalize();
            if (!target.startsWith(thumbnailDirectory)) return "";
            if (!Files.exists(target)) ImageIO.write(thumbnail, "jpg", target.toFile());
            return thumbnailUrlPrefix + "/" + filename;
        } catch (IllegalArgumentException | IOException exception) {
            return "";
        }
    }

    private boolean isThumbnailUrl(String imageUrl) {
        String normalized = imageUrl.toLowerCase(Locale.ROOT);
        return normalized.startsWith(thumbnailUrlPrefix.toLowerCase(Locale.ROOT) + "/")
            || normalized.contains("/thumb/")
            || normalized.contains("/thumbnail/");
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
}
