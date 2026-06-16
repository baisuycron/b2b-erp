package com.erp.b2b.product.search;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ImageSearchController {
    private final ImageSearchService imageSearchService;

    public ImageSearchController(ImageSearchService imageSearchService) {
        this.imageSearchService = imageSearchService;
    }

    @PostMapping("/mall/products/search-by-image")
    public List<ProductImageSearchResult> searchByImage(
        @RequestParam(value = "file", required = false) MultipartFile file,
        @RequestParam(required = false) Long categoryId,
        @RequestParam(required = false) Long brandId,
        @RequestParam(required = false) Integer topK
    ) {
        return imageSearchService.searchByImage(file, categoryId, brandId, topK);
    }

    @PostMapping("/admin/products/images/rebuild-vector")
    public Map<String, Object> rebuildVectors(
        @RequestParam(required = false) Integer limit,
        @RequestParam(defaultValue = "false") boolean full
    ) {
        return imageSearchService.rebuildVectors(limit, full);
    }
}
