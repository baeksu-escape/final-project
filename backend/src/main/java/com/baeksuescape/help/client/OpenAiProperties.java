package com.baeksuescape.help.client;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * FP-181 N-31-2·N-32-2 OpenAI 호출 설정 avenue.ai.openai.* (강사 제공 키, decisions.md 1-4).
 * 키 값은 환경변수 OPENAI_API_KEY에만 넣고 properties에는 avenue.ai.openai.api-key=${OPENAI_API_KEY:}만 둔다(강사 안내: .env 또는 환경변수만).
 * 키가 비어 있으면 AI 기능만 꺼지고 백엔드는 그대로 켜진다.
 * 시간 제한은 D-18(연결 2초 / 응답 15초) — 문장을 만드는 데 몇 초 걸리므로 FastAPI(3초)보다 길게 둔다.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "avenue.ai.openai")
public class OpenAiProperties {

    private static final String DEFAULT_BASE_URL = "https://api.openai.com/v1";
    private static final String DEFAULT_MODEL = "gpt-4o-mini";

    private String apiKey;
    private String model;
    private String baseUrl;
    private int connectTimeoutMillis = 2000;
    private int readTimeoutMillis = 15000;

    /** 키가 들어 있으면 true. 값 자체는 어디에도 출력하지 않는다. */
    public boolean enabled() {
        return StringUtils.hasText(apiKey);
    }

    public String resolvedModel() {
        return StringUtils.hasText(model) ? model.trim() : DEFAULT_MODEL;
    }

    // 비어 있으면 OpenAI 기본 주소, 끝의 '/'는 뗀다(테스트에서는 가짜 서버 주소를 넣는다).
    public String resolvedBaseUrl() {
        String url = StringUtils.hasText(baseUrl) ? baseUrl.trim() : DEFAULT_BASE_URL;
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
