package com.erp.b2b.customer;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/buyer-groups")
public class BuyerGroupController {
    private final BuyerGroupRepository buyerGroupRepository;

    public BuyerGroupController(BuyerGroupRepository buyerGroupRepository) {
        this.buyerGroupRepository = buyerGroupRepository;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam Map<String, String> params) {
        return buyerGroupRepository.page(params);
    }

    @GetMapping("/options")
    public List<Map<String, Object>> options() {
        return buyerGroupRepository.options();
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> request) {
        return buyerGroupRepository.create(request);
    }

    @PutMapping("/{groupId}")
    public Map<String, Object> update(@PathVariable Long groupId, @RequestBody Map<String, Object> request) {
        return buyerGroupRepository.update(groupId, request);
    }

    @PutMapping("/{groupId}/status")
    public Map<String, Object> updateStatus(@PathVariable Long groupId, @RequestBody Map<String, Object> request) {
        return buyerGroupRepository.updateStatus(groupId, request);
    }

    @DeleteMapping("/{groupId}")
    public Map<String, Object> delete(@PathVariable Long groupId) {
        buyerGroupRepository.delete(groupId);
        return Map.of("deleted", true, "id", groupId);
    }

    @GetMapping("/{groupId}/buyers")
    public Map<String, Object> buyers(@PathVariable Long groupId, @RequestParam Map<String, String> params) {
        return buyerGroupRepository.buyers(groupId, params);
    }

    @PostMapping("/{groupId}/buyers")
    public Map<String, Object> assignBuyers(@PathVariable Long groupId, @RequestBody Map<String, Object> request) {
        buyerGroupRepository.assignBuyers(groupId, request);
        return Map.of("assigned", true, "id", groupId);
    }

    @DeleteMapping("/{groupId}/buyers/{buyerId}")
    public Map<String, Object> removeBuyer(@PathVariable Long groupId, @PathVariable Long buyerId, @RequestParam(defaultValue = "SYSTEM") String operatorName) {
        buyerGroupRepository.removeBuyer(groupId, buyerId, operatorName);
        return Map.of("removed", true, "groupId", groupId, "buyerId", buyerId);
    }
}
