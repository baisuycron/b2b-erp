package com.erp.b2b.product;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.erp.b2b.common.ApiException;
import com.erp.b2b.product.search.ImageSearchService;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductRepository productRepository;
    private final ImageSearchService imageSearchService;

    public ProductController(ProductRepository productRepository, ImageSearchService imageSearchService) {
        this.productRepository = productRepository;
        this.imageSearchService = imageSearchService;
    }

    @GetMapping
    public List<Product> list() {
        return productRepository.findAll();
    }

    @GetMapping("/{productId}")
    public Product detail(@PathVariable Long productId) {
        return productRepository.findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    @GetMapping("/spec-types")
    public List<String> listSpecTypes() {
        return productRepository.listSpecTypes();
    }

    @PostMapping("/spec-types")
    public String createSpecType(@Valid @RequestBody SpecTypeRequest request) {
        return productRepository.createSpecType(request.name());
    }

    @PostMapping
    public Product create(@Valid @RequestBody CreateProductRequest request) {
        long suffix = System.currentTimeMillis();
        Product product = productRepository.create(request, "P-" + suffix, "SKU-" + suffix);
        imageSearchService.syncProductImages(product);
        return product;
    }

    @PutMapping("/{productId}")
    public Product update(@PathVariable Long productId, @Valid @RequestBody CreateProductRequest request) {
        Product product = productRepository.update(productId, request);
        imageSearchService.syncProductImages(product);
        return product;
    }

    public record SpecTypeRequest(@NotBlank String name) {
    }
}
