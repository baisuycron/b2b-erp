package com.erp.b2b.mall;

import com.erp.b2b.product.Product;
import com.erp.b2b.product.ProductRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AiChatService {
    private static final int MAX_MESSAGE_LENGTH = 300;

    private final ProductRepository productRepository;
    private final String aiMode;
    private final String openAiApiKey;
    private final String aiModel;

    public AiChatService(
        ProductRepository productRepository,
        @Value("${b2b.ai.mode:rule}") String aiMode,
        @Value("${b2b.ai.openai-api-key:}") String openAiApiKey,
        @Value("${b2b.ai.model:gpt-4.1-mini}") String aiModel
    ) {
        this.productRepository = productRepository;
        this.aiMode = aiMode;
        this.openAiApiKey = openAiApiKey;
        this.aiModel = aiModel;
    }

    public AiChatResult chat(Map<String, Object> request) {
        String message = string(request.get("message"));
        if (message.isBlank()) {
            throw new AiChatException("请输入问题");
        }
        if (message.length() > MAX_MESSAGE_LENGTH) {
            throw new AiChatException("问题内容过长，请简化后再试");
        }

        // TODO: Backend authentication must still protect personal/order/cart APIs. Frontend login redirects are UX only.
        // Future extension point: when AI_MODE=llm and OPENAI_API_KEY is configured, route through an LLM adapter.
        if ("llm".equalsIgnoreCase(aiMode) && !openAiApiKey.isBlank()) {
            return ruleChat(message, Boolean.TRUE.equals(request.get("isLoggedIn")));
        }
        return ruleChat(message, Boolean.TRUE.equals(request.get("isLoggedIn")));
    }

    private AiChatResult ruleChat(String rawMessage, boolean isLoggedIn) {
        String message = rawMessage.toLowerCase(Locale.ROOT);

        if (needsPersonalData(message) && !isLoggedIn) {
            return new AiChatResult(
                "请先登录后查看订单、发票、购物车等个人信息。",
                List.of(),
                List.of(Map.of("type", "login", "label", "去登录"))
            );
        }
        if (containsAny(message, "注册")) {
            return answer("点击页面顶部的【免费注册】，填写账号、密码、手机号后即可注册。注册成功后可以浏览商品详情、加入采购车和下单。");
        }
        if (containsAny(message, "登录", "登陆")) {
            return answer("点击页面顶部的【请登录】，输入账号和密码后即可登录。未登录时可以浏览商城首页，但点击商品、购物车、订单等入口会跳转登录页。");
        }
        if (containsAny(message, "采购车", "购物车")) {
            return answer("找到商品后，进入商品详情页或商品卡片，点击【加入采购车】即可。未登录用户需要先登录。");
        }
        if (containsAny(message, "下单", "购买")) {
            return answer("选择商品规格和采购数量后，点击【立即下单】进入确认订单页。提交订单前请确认收货信息、商品金额和发票信息。");
        }
        if (containsAny(message, "发票")) {
            return answer("订单完成后可以在订单详情或发票中心申请发票。根据店铺支持情况，可提交电子普通发票或电子增值税专用发票。");
        }
        if (containsAny(message, "起批量")) {
            return answer("起批量是指商品最少采购数量。例如起批量为 10 件，则单次采购数量不能低于 10 件。");
        }
        if (containsAny(message, "售卖单位", "销售单位")) {
            return answer("销售单位是买家实际采购时使用的单位，例如箱、包、盒。若商品设置为批量售卖，买家只能按销售单位的倍数购买。");
        }
        if (containsAny(message, "订单")) {
            if (!isLoggedIn) {
                return new AiChatResult("请先登录后查看订单信息。", List.of(), List.of(Map.of("type", "login", "label", "去登录")));
            }
            return answer("当前简易 AI 暂不支持直接查询订单，请前往订单中心查看。");
        }

        List<String> productTerms = productTerms(message);
        if (!productTerms.isEmpty()) {
            List<Map<String, Object>> products = searchProducts(productTerms);
            if (products.isEmpty()) {
                return answer("暂时没有找到匹配商品，你可以换个关键词试试。");
            }
            return new AiChatResult(
                productAnswer(message),
                products,
                products.stream().map(product -> Map.of("type", "viewProduct", "label", "查看商品", "productId", product.get("productId"))).toList()
            );
        }

        return answer("我可以帮你找商品、说明采购流程、注册登录、发票和售后规则。你可以试试问：帮我找饮用水、怎么加入采购车、怎么申请发票。");
    }

    private List<Map<String, Object>> searchProducts(List<String> terms) {
        Set<Long> seen = new LinkedHashSet<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String term : terms) {
            for (Product product : productRepository.searchMallProductsForAssistant(term, 5)) {
                if (seen.add(product.id())) {
                    rows.add(productMap(product));
                    if (rows.size() >= 5) {
                        return rows;
                    }
                }
            }
        }
        return rows;
    }

    private List<String> productTerms(String message) {
        List<String> terms = new ArrayList<>();
        if (containsAny(message, "饮用水", "矿泉水", "水")) {
            terms.addAll(List.of("饮用水", "矿泉水", "水"));
        }
        if (containsAny(message, "可口可乐", "可乐")) {
            terms.addAll(List.of("可口可乐", "可乐"));
        }
        if (containsAny(message, "文件夹", "办公")) {
            terms.addAll(List.of("文件夹", "办公"));
        }
        return terms;
    }

    private String productAnswer(String message) {
        if (containsAny(message, "饮用水", "矿泉水", "水")) {
            return "可以，办公室采购饮用水建议选择整箱装，方便搬运和库存管理。我为你找到了以下商品。";
        }
        if (containsAny(message, "可口可乐", "可乐")) {
            return "我为你找到了可口可乐相关商品，可以查看详情后选择规格和数量。";
        }
        return "我为你找到了相关办公采购商品，可以查看商品详情后加入采购车。";
    }

    private Map<String, Object> productMap(Product product) {
        return Map.of(
            "productId", String.valueOf(product.id()),
            "productName", string(product.productName()),
            "imageUrl", imageUrl(product.mainImageUrl()),
            "price", product.salePrice() == null ? BigDecimal.ZERO : product.salePrice(),
            "saleUnit", saleUnit(product),
            "stock", product.stockQuantity() == null ? 0 : product.stockQuantity()
        );
    }

    private String imageUrl(String value) {
        String url = string(value);
        if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/")) {
            return url;
        }
        return "";
    }

    private String saleUnit(Product product) {
        if ("BATCH".equals(product.saleMode()) && !string(product.saleUnit()).isBlank()) {
            return product.saleUnit();
        }
        return string(product.unit()).isBlank() ? "件" : product.unit();
    }

    private boolean needsPersonalData(String message) {
        boolean personalPrefix = containsAny(message, "我的", "查询", "查看", "状态", "什么时候", "地址", "账户", "账号", "个人信息");
        return personalPrefix && containsAny(message, "订单", "发票", "购物车", "采购车", "账户", "地址");
    }

    private AiChatResult answer(String answer) {
        return new AiChatResult(answer, List.of(), List.of());
    }

    private boolean containsAny(String text, String... words) {
        for (String word : words) {
            if (text.contains(word)) return true;
        }
        return false;
    }

    private String string(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    public record AiChatResult(String answer, List<Map<String, Object>> products, List<Map<String, Object>> actions) {
        public Map<String, Object> toMap() {
            return Map.of("answer", answer, "products", products, "actions", actions);
        }
    }

    public static class AiChatException extends RuntimeException {
        public AiChatException(String message) {
            super(message);
        }
    }
}
