package com.erp.b2b.customer;

import com.erp.b2b.common.ApiException;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    private final CustomerRepository customerRepository;

    public CustomerController(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @GetMapping
    public Object list(@RequestParam Map<String, String> params) {
        if (params.containsKey("page") || params.containsKey("pageSize") || params.containsKey("keyword")
            || params.containsKey("status") || params.containsKey("tab") || params.containsKey("hasOrder")) {
            return customerRepository.page(params);
        }
        return customerRepository.findAll();
    }

    @GetMapping("/{customerId}")
    public Map<String, Object> detail(@PathVariable Long customerId) {
        return customerRepository.detail(customerId);
    }

    @PostMapping
    public Customer create(@Valid @RequestBody CreateCustomerRequest request) {
        validateOperator(request.operatorName());
        validatePhone(phoneOf(request));
        validatePassword(request.password());
        if (customerRepository.existsByPhone(phoneOf(request))) {
            throw new ApiException(HttpStatus.CONFLICT, "该手机号已注册，请直接登录。");
        }
        return customerRepository.create(request, CustomerRepository.nextCustomerCode());
    }

    @PutMapping("/{customerId}")
    public Customer update(@PathVariable Long customerId, @Valid @RequestBody CreateCustomerRequest request) {
        validateOperator(request.operatorName());
        validatePhone(phoneOf(request));
        if (customerRepository.existsByPhoneExceptId(phoneOf(request), customerId)) {
            throw new ApiException(HttpStatus.CONFLICT, "当前手机号已被注册");
        }
        return customerRepository.update(customerId, request);
    }

    @PutMapping("/{customerId}/status")
    public Customer updateStatus(@PathVariable Long customerId, @RequestBody Map<String, Object> request) {
        String operatorName = string(request.get("operatorName"));
        validateOperator(operatorName);
        String status = string(request.getOrDefault("status", "ENABLED")).toUpperCase();
        if (!List.of("ENABLED", "DISABLED").contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "状态值不正确");
        }
        String reason = string(request.get("reason"));
        if ("DISABLED".equals(status) && reason.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "停用原因不能为空");
        }
        return customerRepository.updateStatus(customerId, status, reason, string(request.get("remark")), operatorName);
    }

    @PostMapping("/{customerId}/password/reset")
    public Map<String, Object> resetPassword(@PathVariable Long customerId, @RequestBody Map<String, Object> request) {
        String operatorName = string(request.get("operatorName"));
        validateOperator(operatorName);
        String password = string(request.get("newPassword"));
        validatePassword(password);
        customerRepository.resetPassword(customerId, password, string(request.get("remark")), operatorName);
        return Map.of("reset", true, "customerId", customerId);
    }

    private String phoneOf(CreateCustomerRequest request) {
        return string(request.loginPhone()).isBlank() ? string(request.contactPhone()) : string(request.loginPhone());
    }

    private void validatePhone(String phone) {
        if (phone.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "手机号不能为空");
        }
        if (!phone.matches("^1[3-9]\\d{9}$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "手机号格式不正确");
        }
    }

    private void validatePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "密码不能为空");
        }
        if (password.length() < 6 || password.length() > 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "密码长度必须为 6-20 位");
        }
    }

    private void validateOperator(String operatorName) {
        if (operatorName == null || operatorName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "无法获取当前操作人，请重新登录");
        }
    }

    private String string(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
