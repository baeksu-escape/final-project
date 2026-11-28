package com.baeksuescape.global.search;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * FP-305 Elasticsearch 연결 설정 avenue.search.* (2차 FP-304 신용 라운지 글 검색).
 * 기본은 꺼짐이다. 꺼져 있으면 Elasticsearch를 전혀 부르지 않고 라운지 검색은 기존 Oracle 검색 그대로다(11/28 동주 결정).
 * 개발·시연용 서버는 보안(비밀번호·HTTPS)을 끄고 띄우므로 주소 말고 다른 비밀값은 없다(elasticsearch/README.md).
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "avenue.search")
public class SearchProperties {

    private static final String DEFAULT_URL = "http://localhost:9200";

    private boolean enabled;
    private String url;
    // 검색은 화면 응답을 기다리게 하므로 짧게 둔다(실패하면 FP-306에서 기존 검색으로 대신한다)
    private int connectTimeoutMillis = 1000;
    private int readTimeoutMillis = 3000;

    // 비어 있으면 http://localhost:9200, 끝의 '/'는 뗀다
    public String resolvedUrl() {
        String value = StringUtils.hasText(url) ? url.trim() : DEFAULT_URL;
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
