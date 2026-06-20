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
@RequestMapping("/api/public/product-thumbnails")
public class ProductThumbnailController {
    private final ProductThumbnailService productThumbnailService;

    public ProductThumbnailController(ProductThumbnailService productThumbnailService) {
        this.productThumbnailService = productThumbnailService;
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> thumbnail(@PathVariable String filename) {
        Path thumbnail = productThumbnailService.resolveThumbnail(filename);
        if (thumbnail == null || !Files.isRegularFile(thumbnail)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
            .contentType(MediaType.IMAGE_JPEG)
            .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
            .body(new FileSystemResource(thumbnail));
    }
}
