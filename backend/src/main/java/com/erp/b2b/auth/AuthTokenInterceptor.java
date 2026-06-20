package com.erp.b2b.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthTokenInterceptor implements HandlerInterceptor {
    private final AuthTokenService authTokenService;
    private final ObjectMapper objectMapper;

    public AuthTokenInterceptor(AuthTokenService authTokenService, ObjectMapper objectMapper) {
        this.authTokenService = authTokenService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        String requiredRole = requiredRole(request);
        if (requiredRole == null) return true;

        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.startsWith("Bearer ")
            ? authorization.substring(7).trim()
            : "";
        if (authTokenService.isValid(token, requiredRole)) return true;

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), Map.of(
            "error", "Unauthorized",
            "message", token.isBlank() ? "请先登录" : "登录已过期，请重新登录"
        ));
        return false;
    }

    private String requiredRole(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if ("/api/admin/login".equals(path) || "/api/buyer/login".equals(path) || "/api/buyer/register".equals(path)) return null;
        if (path.startsWith("/api/admin/") || path.startsWith("/api/system/")
            || path.startsWith("/api/customers") || path.startsWith("/api/products")
            || path.startsWith("/api/inventory-movements")) return "ADMIN";
        if (path.startsWith("/api/buyer/") || path.startsWith("/api/orders")) return "BUYER";
        if (path.startsWith("/api/mall/")) {
            if ("GET".equals(method) && (path.equals("/api/mall/products")
                || path.equals("/api/mall/home/products") || path.equals("/api/mall/product-categories")
                || path.matches("/api/mall/products/[^/]+"))) return null;
            if (path.equals("/api/mall/products/search-by-image") || path.equals("/api/mall/ai/chat")) return null;
            return "BUYER";
        }
        return null;
    }
}
