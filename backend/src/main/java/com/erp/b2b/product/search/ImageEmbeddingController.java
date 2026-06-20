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
    public static final int VECTOR_SIZE = 96;
    public static final String MODEL_NAME = "b2b-visual-signature-v3";

    private static final int SAMPLE_SIZE = 64;
    private static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    private static final long MAX_PIXELS = 40_000_000L;

    private final RestClient restClient = RestClient.create();

    @PostMapping(value = "/embed/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> embedImage(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请上传图片");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "图片大小不能超过 5MB");
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
            throw new ApiException(HttpStatus.BAD_REQUEST, "图片大小不能超过 5MB");
        }

        byte[] localBytes = loadLocalImageBytes(imageUrl);
        if (localBytes != null) {
            return localBytes;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "imageUrl cannot be loaded");
    }

    private byte[] loadLocalImageBytes(String imageUrl) {
        String cleanPath = imageUrl.replace('\\', '/');
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

    private byte[] requireMaxSize(byte[] bytes) {
        if (bytes != null && bytes.length <= MAX_IMAGE_SIZE) {
            return bytes;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "图片大小不能超过 5MB");
    }

    private SignatureResult embed(byte[] bytes) {
        BufferedImage source = decodeImage(bytes);
        BufferedImage image = scaleToSample(source);
        double[] vector = new double[VECTOR_SIZE];
        int neutralPixels = 0;
        int coloredPixels = 0;
        int redPixels = 0;
        int bluePixels = 0;
        int darkPixels = 0;

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

                if (colored) {
                    int hueBin = Math.min(35, (int) Math.floor(hue * 36));
                    vector[hueBin] += brightness * (0.35 + saturation * 1.3);
                    int cell = (y / 16) * 4 + (x / 16);
                    vector[60 + cell] += colorFamily(hue, saturation, brightness) + 1;
                }
                vector[36 + Math.min(7, (int) Math.floor(saturation * 8))] += colored ? 0.7 : 0.05;
                vector[44 + Math.min(7, (int) Math.floor(brightness * 8))] += colored ? 0.55 : 0.04;
                vector[52 + colorFamily(hue, saturation, brightness)] += colored ? 1.4 : 0.08;

                int cell = (y / 16) * 4 + (x / 16);
                double redDominance = Math.max(0, red - Math.max(green, blue)) / 255.0;
                double blueDominance = Math.max(0, blue - Math.max(red, green)) / 255.0;
                vector[76 + cell] += colorfulness * (0.25 + saturation) + redDominance * 0.65 + blueDominance * 0.65;
                if (darkPixels > 0 && brightness < 0.22) {
                    vector[92 + Math.min(3, cell / 4)] += 0.4;
                }
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
        return new SignatureResult(embedding, !redDocumentLike, redDocumentLike ? "RED_DOCUMENT_LIKE" : "");
    }

    private BufferedImage decodeImage(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "图片内容为空");
        }
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            BufferedImage image = ImageIO.read(input);
            if (image == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "图片解析失败");
            }
            long pixels = (long) image.getWidth() * image.getHeight();
            if (pixels > MAX_PIXELS) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "图片尺寸过大");
            }
            return image;
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "图片解析失败");
        }
    }

    private BufferedImage scaleToSample(BufferedImage source) {
        BufferedImage image = new BufferedImage(SAMPLE_SIZE, SAMPLE_SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
            graphics.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE, null);
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

    public record ImageUrlRequest(String imageUrl) {
    }

    private record SignatureResult(List<Double> embedding, boolean indexable, String rejectionReason) {
    }
}
