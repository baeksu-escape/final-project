package com.baeksuescape.global.search;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * FP-305 Elasticsearch REST API 호출 — Spring에 원래 있는 RestClient를 쓴다(새 라이브러리 없음, OpenAiClient와 같은 방식).
 * 서버 버전 확인, 색인이 있는지, 색인 만들기를 맡는다. 글 넣기·검색은 FP-306에서 여기에 더한다.
 * 실패는 모두 SearchUnavailableException 하나로 바꾸고, 로그에는 색인 이름·상태 코드·실패 종류만 남긴다(글 내용은 남기지 않는다).
 */
@Component
public class SearchClient {

    private static final Logger log = LoggerFactory.getLogger(SearchClient.class);

    private final RestClient restClient;

    public SearchClient(SearchProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getConnectTimeoutMillis());
        factory.setReadTimeout(properties.getReadTimeoutMillis());
        this.restClient = RestClient.builder()
                .baseUrl(properties.resolvedUrl())
                .requestFactory(factory)
                .build();
    }

    /** GET / — 서버 버전(예: 8.10.4). 응답 모양이 다르면 실패로 본다. */
    @SuppressWarnings("unchecked")
    public String serverVersion() {
        Map<String, Object> body;
        try {
            body = restClient.get().uri("/").retrieve().body(Map.class);
        } catch (RestClientException e) {
            throw failed("서버 확인", e);
        }
        if (body == null || !(body.get("version") instanceof Map<?, ?> version) || !(version.get("number") instanceof String number)) {
            throw new SearchUnavailableException("Elasticsearch 응답에 버전이 없습니다.");
        }
        return number;
    }

    /** HEAD /{index} — 있으면 true, 404면 false. */
    public boolean indexExists(String index) {
        try {
            restClient.head().uri("/{index}", index).retrieve().toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw failed("색인 확인 " + index, e);
        } catch (RestClientException e) {
            throw failed("색인 확인 " + index, e);
        }
    }

    /** PUT /{index} — 설정·매핑 JSON(resources/search/*.json)으로 색인을 만든다. */
    public void createIndex(String index, String settingsJson) {
        try {
            restClient.put()
                    .uri("/{index}", index)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(settingsJson)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            throw failed("색인 만들기 " + index, e);
        }
    }

    private static SearchUnavailableException failed(String action, RestClientException e) {
        if (e instanceof RestClientResponseException response) {
            log.warn("Elasticsearch {} 거절 status={}", action, response.getStatusCode().value());
        } else {
            log.warn("Elasticsearch {} 실패 type={}", action, e.getClass().getSimpleName());
        }
        return new SearchUnavailableException("Elasticsearch " + action + "에 실패했습니다.");
    }
}
