package com.erp.b2b.product;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/product-images")
public class ProductImageController {
    private final ProductImageUrlService productImageUrlService;

    public ProductImageController(ProductImageUrlService productImageUrlService) {
        this.productImageUrlService = productImageUrlService;
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> image(@PathVariable String filename) {
        Path image = productImageUrlService.resolveImage(filename);
        if (image == null || !Files.isRegularFile(image)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
            .contentType(contentType(filename))
            .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
            .body(new FileSystemResource(image));
    }

    private MediaType contentType(String filename) {
        String lower = filename == null ? "" : filename.toLowerCase();
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".gif")) return MediaType.valueOf("image/gif");
        if (lower.endsWith(".webp")) return MediaType.valueOf("image/webp");
        return MediaType.IMAGE_JPEG;
    }
}
