package com.erp.b2b.product.search;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "b2b.image-search")
public record ImageSearchProperties(
    boolean enabled,
    String embeddingServiceUrl,
    String qdrantUrl,
    String qdrantApiKey,
    String collection,
    Integer topKDefault,
    Double minimumScore,
    String embeddingModel
) {
    public int resolvedTopK(int requestedTopK) {
        if (requestedTopK > 0) {
            return Math.min(requestedTopK, 50);
        }
        return topKDefault == null || topKDefault <= 0 ? 20 : Math.min(topKDefault, 50);
    }

    public double resolvedMinimumScore() {
        if (minimumScore == null) {
            return 0.72;
        }
        return Math.max(-1.0, Math.min(1.0, minimumScore));
    }

    public String resolvedEmbeddingModel() {
        if (embeddingModel == null || embeddingModel.isBlank()) {
            return ImageEmbeddingController.MODEL_NAME;
        }
        return embeddingModel.trim();
    }

    public boolean configured() {
        return enabled
            && embeddingServiceUrl != null && !embeddingServiceUrl.isBlank()
            && qdrantUrl != null && !qdrantUrl.isBlank()
            && collection != null && !collection.isBlank();
    }
}
