package com.baeksuescape.assessment.client;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

// FP-142 N-12-2 FastAPI ML-03(POST /v1/assessments/score) 호출 — Spring에 원래 있는 RestClient를 쓴다(새 라이브러리 없음).
// 실패(연결 안 됨·시간 초과·4xx·5xx)는 PredictionFailedException 하나로 바꿔 서비스가 MODEL_ERROR로 처리하게 한다.
// 로그에는 requestId와 실패 종류만 남긴다. 요청 본문(금융 정보)은 남기지 않는다.
@Component
public class PredictionClient {

    private static final Logger log = LoggerFactory.getLogger(PredictionClient.class);

    private final RestClient restClient;

    public PredictionClient(PredictionProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getConnectTimeoutMillis());
        factory.setReadTimeout(properties.getReadTimeoutMillis());
        this.restClient = RestClient.builder()
                .baseUrl(properties.resolvedBaseUrl())
                .requestFactory(factory)
                .build();
    }

    // ML-03 점수 계산. 응답 JSON을 Map으로 그대로 받는다(필드 이름은 B팀 명세서 4-3).
    @SuppressWarnings("unchecked")
    public Map<String, Object> score(Map<String, Object> request) {
        try {
            Map<String, Object> body = restClient.post()
                    .uri("/v1/assessments/score")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(Map.class);
            if (body == null) {
                throw new PredictionFailedException("빈 응답", true);
            }
            return body;
        } catch (HttpClientErrorException e) {
            // 4xx(422 입력 오류·409 버전 불일치) — 다시 보내도 결과가 같아 재시도하지 않는다
            log.warn("ML-03 요청 거절 requestId={} status={}", request.get("requestId"), e.getStatusCode().value());
            throw new PredictionFailedException("HTTP " + e.getStatusCode().value(), false);
        } catch (RestClientException e) {
            // 연결 실패·시간 초과·5xx — 한 번 다시 시도할 수 있다
            log.warn("ML-03 호출 실패 requestId={} type={}", request.get("requestId"), e.getClass().getSimpleName());
            throw new PredictionFailedException(e.getClass().getSimpleName(), true);
        }
    }

    // FastAPI 호출 실패 — retryable이면 서비스가 한 번 다시 시도하고, 그래도 실패하거나 retryable이 아니면 MODEL_ERROR로 저장한다.
    public static class PredictionFailedException extends RuntimeException {
        private final boolean retryable;

        public PredictionFailedException(String reason, boolean retryable) {
            super(reason);
            this.retryable = retryable;
        }

        public boolean isRetryable() {
            return retryable;
        }
    }
}
