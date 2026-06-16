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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    private final CustomerRepository customerRepository;

    public CustomerController(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @GetMapping
    public List<Customer> list() {
        return customerRepository.findAll();
    }

    @PostMapping
    public Customer create(@Valid @RequestBody CreateCustomerRequest request) {
        if (customerRepository.existsByContactPhone(request.contactPhone().trim())) {
            throw new ApiException(HttpStatus.CONFLICT, "\u5f53\u524d\u624b\u673a\u53f7\u5df2\u88ab\u6ce8\u518c");
        }
        String code = "CUST-" + System.currentTimeMillis();
        return customerRepository.create(request, code);
    }

    @PutMapping("/{customerId}")
    public Customer update(@PathVariable Long customerId, @Valid @RequestBody CreateCustomerRequest request) {
        if (customerRepository.existsByContactPhoneExceptId(request.contactPhone().trim(), customerId)) {
            throw new ApiException(HttpStatus.CONFLICT, "\u5f53\u524d\u624b\u673a\u53f7\u5df2\u88ab\u6ce8\u518c");
        }
        return customerRepository.update(customerId, request);
    }

    @PutMapping("/{customerId}/status")
    public Customer updateStatus(@PathVariable Long customerId, @RequestBody Map<String, Object> request) {
        String status = String.valueOf(request.getOrDefault("status", "ENABLED"));
        return customerRepository.updateStatus(customerId, status);
    }
}
