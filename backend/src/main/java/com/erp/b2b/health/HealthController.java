package com.erp.b2b.health;

import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "UP",
            "service", "b2b-api",
            "checkedAt", OffsetDateTime.now().toString()
        );
    }
}
