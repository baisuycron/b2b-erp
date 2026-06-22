package com.erp.b2b.product.search;

import com.erp.b2b.common.ApiException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/internal/image-embedding")
public class ImageEmbeddingController {
    public static final int VECTOR_SIZE = 520;
    public static final String MODEL_NAME = "b2b-visual-signature-v4";

    private static final int SAMPLE_SIZE = 64;
    private static final int STRUCTURE_SIZE = 16;
    private static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    private static final long MAX_PIXELS = 40_000_000L;

    private final RestClient restClient = RestClient.create();
    private final Path imageDirectory;
    private final String imageUrlPrefix;
    private final Path thumbnailDirectory;
    private final String thumbnailUrlPrefix;

    public ImageEmbeddingController(
        @Value("${b2b.product-image.directory}") String imageDirectory,
        @Value("${b2b.product-image.url-prefix:/api/public/product-images}") String imageUrlPrefix,
        @Value("${b2b.product-thumbnail.directory}") String thumbnailDirectory,
        @Value("${b2b.product-thumbnail.url-prefix:/api/public/product-thumbnails}") String thumbnailUrlPrefix
    ) {
        this.imageDirectory = resolveConfiguredDirectory(imageDirectory);
        this.imageUrlPrefix = trimRight(imageUrlPrefix);
        this.thumbnailDirectory = resolveConfiguredDirectory(thumbnailDirectory);
        this.thumbnailUrlPrefix = trimRight(thumbnailUrlPrefix);
    }

    @PostMapping(value = "/embed/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> embedImage(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "鍥剧墖澶у皬涓嶈兘瓒呰繃 5MB");
        }
        return response(embed(file.getBytes()));
    }

    @PostMapping(value = "/embed/image-url", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> embedImageUrl(@RequestBody ImageUrlRequest request) {
        String imageUrl = request == null ? "" : text(request.imageUrl());
        if (imageUrl.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "imageUrl is required");
        }
        return response(embed(loadImageBytes(imageUrl)));
    }

    @PostMapping(value = "/compare/image-url", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> compareImageUrl(
        @RequestParam("file") MultipartFile file,
        @RequestParam("imageUrl") String imageUrl
    ) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image size cannot exceed 5MB");
        }
        VerificationResult result = verifySameImage(file.getBytes(), loadImageBytes(text(imageUrl)));
        return Map.of(
            "verified", result.verified(),
            "score", result.score(),
            "dHashDistance", result.dHashDistance(),
            "aHashDistance", result.aHashDistance(),
            "pHashDistance", result.pHashDistance(),
            "histogramIntersection", result.histogramIntersection()
        );
    }

    private byte[] loadImageBytes(String imageUrl) {
        if (imageUrl.startsWith("data:")) {
            int comma = imageUrl.indexOf(',');
            if (comma > 0) {
                String metadata = imageUrl.substring(0, comma).toLowerCase();
                String payload = imageUrl.substring(comma + 1);
                if (metadata.contains(";base64")) {
                    return requireMaxSize(Base64.getDecoder().decode(payload.replaceAll("\\s+", "")));
                }
                return requireMaxSize(payload.getBytes(StandardCharsets.UTF_8));
            }
        }
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            byte[] bytes = restClient.get()
                .uri(URI.create(imageUrl))
                .retrieve()
                .body(byte[].class);
            if (bytes != null && bytes.length <= MAX_IMAGE_SIZE) {
                return bytes;
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "鍥剧墖澶у皬涓嶈兘瓒呰繃 5MB");
        }

        byte[] localBytes = loadLocalImageBytes(imageUrl);
        if (localBytes != null) {
            return localBytes;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "imageUrl cannot be loaded");
    }

    private byte[] loadLocalImageBytes(String imageUrl) {
        String cleanPath = imageUrl.replace('\\', '/');
        byte[] storedProductImage = loadManagedImageBytes(cleanPath, imageUrlPrefix, imageDirectory);
        if (storedProductImage != null) {
            return storedProductImage;
        }
        byte[] storedThumbnail = loadManagedImageBytes(cleanPath, thumbnailUrlPrefix, thumbnailDirectory);
        if (storedThumbnail != null) {
            return storedThumbnail;
        }

        if (cleanPath.startsWith("/")) {
            String resourcePath = "static/" + cleanPath.substring(1);
            try (InputStream input = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
                if (input != null) {
                    byte[] bytes = input.readAllBytes();
                    return requireMaxSize(bytes);
                }
            } catch (IOException ignored) {
                return null;
            }
        }

        Path path = Path.of(cleanPath);
        if (!path.isAbsolute()) {
            path = Path.of(System.getProperty("user.dir")).resolve(cleanPath).normalize();
        }
        try {
            if (Files.isRegularFile(path) && Files.size(path) <= MAX_IMAGE_SIZE) {
                return requireMaxSize(Files.readAllBytes(path));
            }
        } catch (IOException ignored) {
            return null;
        }
        return null;
    }

    private Path resolveConfiguredDirectory(String directory) {
        Path configured = Path.of(directory == null || directory.isBlank() ? "." : directory);
        return (configured.isAbsolute() ? configured : Path.of(System.getProperty("user.home")).resolve(configured))
            .toAbsolutePath()
            .normalize();
    }

    private byte[] loadManagedImageBytes(String imageUrl, String prefix, Path directory) {
        String cleanPrefix = trimRight(prefix);
        if (cleanPrefix.isBlank() || !imageUrl.toLowerCase().startsWith((cleanPrefix + "/").toLowerCase())) {
            return null;
        }
        String filename = imageUrl.substring(cleanPrefix.length() + 1);
        if (filename.contains("/") || filename.contains("\\") || !filename.matches("[0-9]+-[0-9a-f]{16,24}(?:-(?:thumb|card))?\\.(jpg|jpeg|png|gif|webp)")) {
            return null;
        }
        Path resolved = directory.resolve(filename).normalize();
        try {
            if (resolved.startsWith(directory) && Files.isRegularFile(resolved) && Files.size(resolved) <= MAX_IMAGE_SIZE) {
                return requireMaxSize(Files.readAllBytes(resolved));
            }
        } catch (IOException ignored) {
            return null;
        }
        return null;
    }

    private byte[] requireMaxSize(byte[] bytes) {
        if (bytes != null && bytes.length <= MAX_IMAGE_SIZE) {
            return bytes;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "鍥剧墖澶у皬涓嶈兘瓒呰繃 5MB");
    }

    private SignatureResult embed(byte[] bytes) {
        BufferedImage source = decodeImage(bytes);
        BufferedImage image = fitToSample(source, SAMPLE_SIZE, SAMPLE_SIZE);
        BufferedImage structure = scaleToSize(image, STRUCTURE_SIZE, STRUCTURE_SIZE);
        BufferedImage hash = scaleToSize(image, STRUCTURE_SIZE + 1, STRUCTURE_SIZE);
        double[] vector = new double[VECTOR_SIZE];
        int neutralPixels = 0;
        int coloredPixels = 0;
        int redPixels = 0;
        int bluePixels = 0;
        int darkPixels = 0;

        double[] grayscale = new double[STRUCTURE_SIZE * STRUCTURE_SIZE];
        double grayscaleTotal = 0;
        for (int y = 0; y < STRUCTURE_SIZE; y += 1) {
            for (int x = 0; x < STRUCTURE_SIZE; x += 1) {
                double value = luminance(structure.getRGB(x, y)) / 255.0;
                grayscale[y * STRUCTURE_SIZE + x] = value;
                grayscaleTotal += value;
            }
        }
        double grayscaleMean = grayscaleTotal / grayscale.length;
        double grayscaleVariance = 0;
        for (double value : grayscale) {
            grayscaleVariance += Math.pow(value - grayscaleMean, 2);
        }
        double grayscaleStdDev = Math.sqrt(grayscaleVariance / grayscale.length);
        double grayscaleDivisor = grayscaleStdDev == 0 ? 1 : grayscaleStdDev;
        for (int index = 0; index < grayscale.length; index += 1) {
            vector[index] = ((grayscale[index] - grayscaleMean) / grayscaleDivisor) * 0.8;
        }

        for (int y = 0; y < STRUCTURE_SIZE; y += 1) {
            for (int x = 0; x < STRUCTURE_SIZE; x += 1) {
                double current = luminance(hash.getRGB(x, y));
                double next = luminance(hash.getRGB(x + 1, y));
                vector[256 + y * STRUCTURE_SIZE + x] = (current > next ? 1 : -1) * 0.35;
            }
        }

        for (int y = 0; y < SAMPLE_SIZE; y += 1) {
            for (int x = 0; x < SAMPLE_SIZE; x += 1) {
                int rgb = image.getRGB(x, y);
                int red = (rgb >> 16) & 0xff;
                int green = (rgb >> 8) & 0xff;
                int blue = rgb & 0xff;
                float[] hsb = Color.RGBtoHSB(red, green, blue, null);
                double hue = hsb[0];
                double saturation = hsb[1];
                double brightness = hsb[2];
                double degrees = hue * 360.0;
                int max = Math.max(red, Math.max(green, blue));
                int min = Math.min(red, Math.min(green, blue));
                double colorfulness = (max - min) / 255.0;
                boolean neutral = saturation < 0.14 || colorfulness < 0.10 || brightness > 0.94;
                boolean colored = !neutral && brightness > 0.12;

                if (neutral) {
                    neutralPixels += 1;
                }
                if (colored) {
                    coloredPixels += 1;
                    if (degrees >= 340 || degrees < 35) redPixels += 1;
                    if (degrees >= 185 && degrees < 260) bluePixels += 1;
                }
                if (brightness < 0.22) {
                    darkPixels += 1;
                }

                vector[512 + colorFamily(hue, saturation, brightness)] += 0.2;
            }
        }

        double norm = Math.sqrt(Arrays.stream(vector).map(value -> value * value).sum());
        double divisor = norm == 0 ? 1 : norm;
        List<Double> embedding = Arrays.stream(vector)
            .map(value -> value / divisor)
            .boxed()
            .toList();
        double neutralRatio = neutralPixels / (double) (SAMPLE_SIZE * SAMPLE_SIZE);
        double redRatio = coloredPixels == 0 ? 0 : redPixels / (double) coloredPixels;
        double blueRatio = coloredPixels == 0 ? 0 : bluePixels / (double) coloredPixels;
        double darkRatio = darkPixels / (double) (SAMPLE_SIZE * SAMPLE_SIZE);
        boolean redDocumentLike = neutralRatio > 0.78
            && coloredPixels > 80
            && redRatio > 0.42
            && blueRatio < 0.18
            && darkRatio < 0.22;
        boolean lowColorDocumentLike = neutralRatio > 0.94
            && coloredPixels < 120
            && darkRatio < 0.08;
        boolean indexable = !redDocumentLike && !lowColorDocumentLike;
        String rejectionReason = redDocumentLike
            ? "RED_DOCUMENT_LIKE"
            : lowColorDocumentLike ? "LOW_COLOR_DOCUMENT_LIKE" : "";
        return new SignatureResult(embedding, indexable, rejectionReason);
    }

    private VerificationResult verifySameImage(byte[] leftBytes, byte[] rightBytes) {
        BufferedImage left = decodeImage(leftBytes);
        BufferedImage right = decodeImage(rightBytes);
        double dHashDistance = hammingDistance(dHash(left), dHash(right));
        double aHashDistance = hammingDistance(aHash(left), aHash(right));
        double pHashDistance = hammingDistance(pHash(left), pHash(right));
        double histogramIntersection = histogramIntersection(colorHistogram(left), colorHistogram(right));
        boolean verified = (pHashDistance <= 0.30 && histogramIntersection >= 0.72)
            || (pHashDistance <= 0.34 && histogramIntersection >= 0.82)
            || (dHashDistance <= 0.32 && aHashDistance <= 0.30 && histogramIntersection >= 0.50)
            || (pHashDistance <= 0.18 && histogramIntersection >= 0.45);
        double score = Math.max(0, Math.min(1,
            0.45 * (1 - pHashDistance)
                + 0.25 * (1 - dHashDistance)
                + 0.15 * (1 - aHashDistance)
                + 0.15 * histogramIntersection
        ));
        return new VerificationResult(verified, score, dHashDistance, aHashDistance, pHashDistance, histogramIntersection);
    }

    private boolean[] dHash(BufferedImage source) {
        BufferedImage image = scaleToSize(fitToSample(source, 256, 256), 17, 16);
        boolean[] bits = new boolean[256];
        for (int y = 0; y < 16; y += 1) {
            for (int x = 0; x < 16; x += 1) {
                bits[y * 16 + x] = luminance(image.getRGB(x, y)) > luminance(image.getRGB(x + 1, y));
            }
        }
        return bits;
    }

    private boolean[] aHash(BufferedImage source) {
        BufferedImage image = scaleToSize(fitToSample(source, 256, 256), 16, 16);
        double total = 0;
        int[] values = new int[256];
        for (int y = 0; y < 16; y += 1) {
            for (int x = 0; x < 16; x += 1) {
                int value = luminance(image.getRGB(x, y));
                values[y * 16 + x] = value;
                total += value;
            }
        }
        double mean = total / values.length;
        boolean[] bits = new boolean[256];
        for (int index = 0; index < values.length; index += 1) {
            bits[index] = values[index] > mean;
        }
        return bits;
    }

    private boolean[] pHash(BufferedImage source) {
        BufferedImage image = scaleToSize(fitToSample(source, 256, 256), 32, 32);
        double[][] pixels = new double[32][32];
        for (int y = 0; y < 32; y += 1) {
            for (int x = 0; x < 32; x += 1) {
                pixels[y][x] = luminance(image.getRGB(x, y));
            }
        }
        double[] low = new double[255];
        int cursor = 0;
        for (int u = 0; u < 16; u += 1) {
            for (int v = 0; v < 16; v += 1) {
                if (u == 0 && v == 0) continue;
                double sum = 0;
                for (int y = 0; y < 32; y += 1) {
                    for (int x = 0; x < 32; x += 1) {
                        sum += pixels[y][x]
                            * Math.cos(Math.PI * (2 * x + 1) * u / 64.0)
                            * Math.cos(Math.PI * (2 * y + 1) * v / 64.0);
                    }
                }
                low[cursor++] = sum;
            }
        }
        double[] sorted = Arrays.copyOf(low, low.length);
        Arrays.sort(sorted);
        double median = sorted[sorted.length / 2];
        boolean[] bits = new boolean[low.length];
        for (int index = 0; index < low.length; index += 1) {
            bits[index] = low[index] > median;
        }
        return bits;
    }

    private double[] colorHistogram(BufferedImage source) {
        BufferedImage image = fitToSample(source, 128, 128);
        double[] bins = new double[64];
        for (int y = 0; y < image.getHeight(); y += 1) {
            for (int x = 0; x < image.getWidth(); x += 1) {
                int rgb = image.getRGB(x, y);
                int red = (rgb >> 16) & 0xff;
                int green = (rgb >> 8) & 0xff;
                int blue = rgb & 0xff;
                bins[(red / 64) * 16 + (green / 64) * 4 + (blue / 64)] += 1;
            }
        }
        double total = Arrays.stream(bins).sum();
        if (total == 0) return bins;
        for (int index = 0; index < bins.length; index += 1) {
            bins[index] /= total;
        }
        return bins;
    }

    private double hammingDistance(boolean[] left, boolean[] right) {
        int length = Math.min(left.length, right.length);
        if (length == 0) return 1;
        int distance = 0;
        for (int index = 0; index < length; index += 1) {
            if (left[index] != right[index]) distance += 1;
        }
        return distance / (double) length;
    }

    private double histogramIntersection(double[] left, double[] right) {
        int length = Math.min(left.length, right.length);
        double result = 0;
        for (int index = 0; index < length; index += 1) {
            result += Math.min(left[index], right[index]);
        }
        return result;
    }

    private BufferedImage decodeImage(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "鍥剧墖鍐呭涓虹┖");
        }
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            BufferedImage image = ImageIO.read(input);
            if (image == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "鍥剧墖瑙ｆ瀽澶辫触");
            }
            long pixels = (long) image.getWidth() * image.getHeight();
            if (pixels > MAX_PIXELS) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "鍥剧墖灏哄杩囧ぇ");
            }
            return image;
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "鍥剧墖瑙ｆ瀽澶辫触");
        }
    }

    private int luminance(int rgb) {
        int red = (rgb >> 16) & 0xff;
        int green = (rgb >> 8) & 0xff;
        int blue = rgb & 0xff;
        return (int) Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
    }

    private BufferedImage fitToSample(BufferedImage source, int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        double scale = Math.min(width / (double) source.getWidth(), height / (double) source.getHeight());
        int drawWidth = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int drawHeight = Math.max(1, (int) Math.round(source.getHeight() * scale));
        int drawX = (width - drawWidth) / 2;
        int drawY = (height - drawHeight) / 2;
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.drawImage(source, drawX, drawY, drawWidth, drawHeight, null);
        } finally {
            graphics.dispose();
        }
        return image;
    }

    private BufferedImage scaleToSize(BufferedImage source, int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return image;
    }

    private int colorFamily(double hue, double saturation, double brightness) {
        if (brightness < 0.18) return 6;
        if (saturation < 0.16) return 7;
        double degrees = hue * 360.0;
        if (degrees >= 340 || degrees < 20) return 0;
        if (degrees < 70) return 1;
        if (degrees < 165) return 2;
        if (degrees < 205) return 3;
        if (degrees < 260) return 4;
        if (degrees < 340) return 5;
        return 7;
    }

    private Map<String, Object> response(SignatureResult result) {
        return Map.of(
            "embedding", result.embedding(),
            "dimensions", VECTOR_SIZE,
            "model", MODEL_NAME,
            "indexable", result.indexable(),
            "rejectionReason", result.rejectionReason()
        );
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String trimRight(String value) {
        return value == null ? "" : value.trim().replaceAll("/+$", "");
    }

    public record ImageUrlRequest(String imageUrl) {
    }

    private record SignatureResult(List<Double> embedding, boolean indexable, String rejectionReason) {
    }

    private record VerificationResult(
        boolean verified,
        double score,
        double dHashDistance,
        double aHashDistance,
        double pHashDistance,
        double histogramIntersection
    ) {
    }
}
