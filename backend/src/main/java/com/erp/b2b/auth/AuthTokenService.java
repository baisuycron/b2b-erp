package com.erp.b2b.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AuthTokenService {
    private static final String VERSION = "v1";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private final byte[] secret;
    private final Duration tokenTtl;

    public AuthTokenService(
        @Value("${b2b.auth.token-secret}") String tokenSecret,
        @Value("${b2b.auth.token-ttl:PT24H}") Duration tokenTtl
    ) {
        if (tokenSecret == null || tokenSecret.length() < 32) {
            throw new IllegalArgumentException("b2b.auth.token-secret must contain at least 32 characters");
        }
        if (tokenTtl == null || tokenTtl.isZero() || tokenTtl.isNegative()) {
            throw new IllegalArgumentException("b2b.auth.token-ttl must be positive");
        }
        this.secret = tokenSecret.getBytes(StandardCharsets.UTF_8);
        this.tokenTtl = tokenTtl;
    }

    public IssuedToken issue(String role, String subject) {
        Instant expiresAt = Instant.now().plus(tokenTtl);
        String encodedSubject = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(String.valueOf(subject).getBytes(StandardCharsets.UTF_8));
        String payload = String.join(".", VERSION, role, String.valueOf(expiresAt.getEpochSecond()), encodedSubject);
        return new IssuedToken(payload + "." + sign(payload), expiresAt, tokenTtl.toSeconds());
    }

    public boolean isValid(String token, String expectedRole) {
        if (token == null || token.isBlank()) return false;
        String[] parts = token.split("\\.", -1);
        if (parts.length != 5 || !VERSION.equals(parts[0]) || !expectedRole.equals(parts[1])) return false;
        try {
            long expiresAt = Long.parseLong(parts[2]);
            if (Instant.now().getEpochSecond() >= expiresAt) return false;
            Base64.getUrlDecoder().decode(parts[3]);
            String payload = String.join(".", parts[0], parts[1], parts[2], parts[3]);
            byte[] expectedSignature = Base64.getUrlDecoder().decode(sign(payload));
            byte[] actualSignature = Base64.getUrlDecoder().decode(parts[4]);
            return MessageDigest.isEqual(expectedSignature, actualSignature);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign authentication token", exception);
        }
    }

    public record IssuedToken(String value, Instant expiresAt, long expiresInSeconds) {}
}
