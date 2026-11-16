package com.baeksuescape.assessment.client;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import lombok.Getter;
import lombok.Setter;

// FP-142 점수 계산 서버(FastAPI) 설정 avenue.prediction.* — 주소와 시간 제한(O-11: 연결 1초 / 응답 3초).
// 공용 AvenueProperties를 건드리지 않으려고 따로 둔다. 주소를 비워 두면 각자 PC의 http://localhost:8000을 쓴다.
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "avenue.prediction")
public class PredictionProperties {

    private static final String DEFAULT_BASE_URL = "http://localhost:8000";

    private String baseUrl;
    private int connectTimeoutMillis = 1000;
    private int readTimeoutMillis = 3000;

    // 비어 있으면 기본 주소, 끝의 '/'는 뗀다.
    public String resolvedBaseUrl() {
        String url = StringUtils.hasText(baseUrl) ? baseUrl.trim() : DEFAULT_BASE_URL;
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
