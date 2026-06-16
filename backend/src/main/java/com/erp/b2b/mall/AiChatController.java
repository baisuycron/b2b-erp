package com.erp.b2b.mall;

import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mall/ai")
public class AiChatController {
    private final AiChatService aiChatService;

    public AiChatController(AiChatService aiChatService) {
        this.aiChatService = aiChatService;
    }

    @PostMapping("/chat")
    public Map<String, Object> chat(@RequestBody Map<String, Object> request) {
        try {
            AiChatService.AiChatResult result = aiChatService.chat(request);
            return Map.of("code", 0, "message", "success", "data", result.toMap());
        } catch (AiChatService.AiChatException error) {
            return Map.of("code", 1, "message", error.getMessage(), "data", Map.of("answer", error.getMessage()));
        } catch (Exception error) {
            return Map.of("code", 1, "message", "AI助手暂时不可用，请稍后重试", "data", Map.of("answer", "AI助手暂时不可用，请稍后重试"));
        }
    }
}
