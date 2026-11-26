package com.baeksuescape.help.client;

import com.baeksuescape.global.exception.ApiException;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * FP-181 N-31-2·N-32-2 OpenAI Chat Completions(POST /chat/completions) 호출.
 * Spring에 원래 있는 RestClient를 쓴다(새 라이브러리 없음, Spring AI는 Spring Boot 3.4 이상이라 쓰지 않음).
 * 키가 없으면 503 AI_UNAVAILABLE, 연결 실패·시간 초과·4xx·5xx·빈 답이면 502 AI_FAILED로 바꾼다.
 * 로그에는 실패 종류와 상태 코드만 남긴다. 보낸 글(질문·점수)과 키는 남기지 않는다.
 */
@Component
public class OpenAiClient {

    public static final String AI_UNAVAILABLE = "AI_UNAVAILABLE";
    public static final String AI_FAILED = "AI_FAILED";

    private static final Logger log = LoggerFactory.getLogger(OpenAiClient.class);

    private final OpenAiProperties properties;
    private final RestClient restClient;

    public OpenAiClient(OpenAiProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getConnectTimeoutMillis());
        factory.setReadTimeout(properties.getReadTimeoutMillis());
        this.restClient = RestClient.builder()
                .baseUrl(properties.resolvedBaseUrl())
                .requestFactory(factory)
                .build();
    }

    /** 키가 들어 있어 AI를 부를 수 있으면 true */
    public boolean enabled() {
        return properties.enabled();
    }

    /**
     * 지시 문장(system)과 보낼 글(user)로 답 한 개를 받는다. 앞뒤 공백을 뗀 답을 돌려준다.
     *
     * @param maxTokens 답 길이 상한(토큰). 비용과 화면 길이를 함께 막는다.
     */
    @SuppressWarnings("unchecked")
    public String complete(String system, String user, int maxTokens) {
        if (!enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, AI_UNAVAILABLE, "AI 기능이 아직 준비되지 않았습니다.");
        }
        Map<String, Object> request = Map.of(
                "model", properties.resolvedModel(),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)),
                "max_completion_tokens", maxTokens);
        Map<String, Object> body;
        try {
            body = restClient.post()
                    .uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey().trim())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException e) {
            // 401(키 오류)·429(한도)·5xx 모두 사용자가 고칠 수 없어 같은 오류로 알린다
            log.warn("OpenAI 호출 거절 status={}", e.getStatusCode().value());
            throw failed();
        } catch (RestClientException e) {
            log.warn("OpenAI 호출 실패 type={}", e.getClass().getSimpleName());
            throw failed();
        }
        String answer = firstAnswer(body);
        if (!StringUtils.hasText(answer)) {
            log.warn("OpenAI 빈 답");
            throw failed();
        }
        return answer.trim();
    }

    // choices[0].message.content. 모양이 다르면 null
    private static String firstAnswer(Map<String, Object> body) {
        if (body == null || !(body.get("choices") instanceof List<?> choices) || choices.isEmpty()
                || !(choices.get(0) instanceof Map<?, ?> choice) || !(choice.get("message") instanceof Map<?, ?> message)) {
            return null;
        }
        return message.get("content") instanceof String content ? content : null;
    }

    private static ApiException failed() {
        return new ApiException(HttpStatus.BAD_GATEWAY, AI_FAILED, "AI 답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
}
