package com.baeksuescape.assessment.client;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

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

    // FP-170 N-18-5 ML-04 시뮬레이션(POST /v1/assessments/simulate) 호출 — 저장된 평가의 피처값에서 바꾼 값만 덮어써 다시 계산한다.
    // score()와 같은 RestClient·타임아웃을 쓴다. 실패는 화면에 그대로 알려야 하므로 상태 코드·오류 코드·칸 오류를 담아 던진다.
    @SuppressWarnings("unchecked")
    public Map<String, Object> simulate(Map<String, Object> request) {
        try {
            Map<String, Object> body = restClient.post()
                    .uri("/v1/assessments/simulate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(Map.class);
            if (body == null) {
                throw new SimulationFailedException(503, "MODEL_NOT_READY", List.of());
            }
            return body;
        } catch (HttpClientErrorException e) {
            // 4xx(422 입력 오류·409 버전 불일치) — FastAPI 오류 본문 {code, message, fieldErrors}을 읽어 넘긴다
            log.warn("ML-04 요청 거절 requestId={} status={}", request.get("requestId"), e.getStatusCode().value());
            Map<String, Object> error = readErrorBody(e);
            return throwSimulationFailure(e.getStatusCode().value(), error);
        } catch (RestClientException e) {
            // 연결 실패·시간 초과·5xx — 모두 "점수 계산 서버 준비 중"으로 알린다
            log.warn("ML-04 호출 실패 requestId={} type={}", request.get("requestId"), e.getClass().getSimpleName());
            throw new SimulationFailedException(503, "MODEL_NOT_READY", List.of());
        }
    }

    // FastAPI 오류 본문을 Map으로 읽는다. 본문이 JSON이 아니면 빈 Map.
    @SuppressWarnings("unchecked")
    private Map<String, Object> readErrorBody(HttpClientErrorException e) {
        try {
            Map<String, Object> body = e.getResponseBodyAs(Map.class);
            return body == null ? Map.of() : body;
        } catch (RuntimeException ignored) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> throwSimulationFailure(int status, Map<String, Object> error) {
        List<FieldErrorItem> fieldErrors = new ArrayList<>();
        if (error.get("fieldErrors") instanceof List<?> items) {
            for (Object item : items) {
                if (item instanceof Map<?, ?> m) {
                    fieldErrors.add(new FieldErrorItem(String.valueOf(m.get("field")), String.valueOf(m.get("message"))));
                }
            }
        }
        Object code = error.get("code");
        throw new SimulationFailedException(status, code == null ? null : code.toString(), fieldErrors);
    }

    // FP-170 ML-04 호출 실패 — HTTP 상태(4xx는 FastAPI 값, 연결 실패·5xx는 503)와 FastAPI 오류 코드·칸 오류를 담는다.
    // 시뮬레이터는 저장하지 않으므로 서비스가 이 값으로 화면 오류(400·409·503)를 정한다.
    public static class SimulationFailedException extends RuntimeException {
        private final int status;
        private final String code;
        private final List<FieldErrorItem> fieldErrors;

        public SimulationFailedException(int status, String code, List<FieldErrorItem> fieldErrors) {
            super("ML-04 HTTP " + status + (code == null ? "" : " " + code));
            this.status = status;
            this.code = code;
            this.fieldErrors = fieldErrors == null ? List.of() : List.copyOf(fieldErrors);
        }

        public int getStatus() {
            return status;
        }

        public String getCode() {
            return code;
        }

        public List<FieldErrorItem> getFieldErrors() {
            return fieldErrors;
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
