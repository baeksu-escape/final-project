package com.baeksuescape.global.search;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * FP-305 서버가 다 켜진 뒤 Elasticsearch 연결을 확인하고, 등록된 색인(SearchIndexDefinition) 중 없는 것을 만든다.
 * 꺼져 있으면(avenue.search.enabled=false, 기본) 아무것도 부르지 않는다.
 * Elasticsearch가 없거나 실패해도 서버는 그대로 켜지고 경고 로그만 남긴다(대안 데이터 폴더가 없을 때와 같은 방식).
 */
@Component
public class SearchIndexInitializer {

    private static final Logger log = LoggerFactory.getLogger(SearchIndexInitializer.class);
    // 개발·시연 서버 버전(elasticsearch/README.md). Spring Boot 3.2.5의 클라이언트 버전과 같게 맞췄다(11/28 결정).
    static final String EXPECTED_VERSION = "8.10.4";

    private final SearchProperties properties;
    private final SearchClient client;
    private final List<SearchIndexDefinition> indexes;

    public SearchIndexInitializer(SearchProperties properties, SearchClient client, List<SearchIndexDefinition> indexes) {
        this.properties = properties;
        this.client = client;
        this.indexes = indexes;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        initialize();
    }

    // 테스트에서 직접 부른다.
    void initialize() {
        if (!properties.isEnabled()) {
            return;
        }
        try {
            String version = client.serverVersion();
            if (!EXPECTED_VERSION.equals(version)) {
                log.warn("Elasticsearch 버전이 {}입니다. 팀 기준은 {}입니다(elasticsearch/README.md).", version, EXPECTED_VERSION);
            }
            log.info("Elasticsearch {} 연결 ({})", version, properties.resolvedUrl());
            for (SearchIndexDefinition index : indexes) {
                if (client.indexExists(index.name())) {
                    log.info("Elasticsearch 색인 {} 있음", index.name());
                } else {
                    client.createIndex(index.name(), index.readJson());
                    log.info("Elasticsearch 색인 {} 만듦", index.name());
                }
            }
        } catch (SearchUnavailableException | IllegalStateException e) {
            log.warn("Elasticsearch를 준비하지 못했습니다. 검색은 기존 방식으로 동작합니다. avenue.search.url과 서버 실행을 확인하세요(elasticsearch/README.md).");
        }
    }
}
