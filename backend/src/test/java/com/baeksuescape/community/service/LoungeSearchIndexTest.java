package com.baeksuescape.community.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.baeksuescape.global.search.SearchIndexDefinition;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * FP-305 라운지 색인 설정(resources/search/lounge-posts.json) 테스트 — 올바른 JSON인지, 제목·본문이 nori 한글 분석기를 쓰는지,
 * 매핑이 정한 필드만 받는지(dynamic strict) 본다. 실제 Elasticsearch가 받아들이는지는 elasticsearch/README.md의 확인 명령으로 본다.
 */
class LoungeSearchIndexTest {

    private final SearchIndexDefinition definition = new LoungeSearchIndex().loungePostsIndex();

    private JsonNode json() throws Exception {
        return new ObjectMapper().readTree(definition.readJson());
    }

    @Test
    @DisplayName("색인 이름은 lounge_posts이고 설정 파일을 읽을 수 있다")
    void nameAndFile() throws Exception {
        assertEquals("lounge_posts", definition.name());
        assertTrue(json().isObject());
    }

    @Test
    @DisplayName("분석기 lounge_korean은 nori 토크나이저와 품사 걸러내기를 쓴다")
    void koreanAnalyzer() throws Exception {
        JsonNode analysis = json().path("settings").path("analysis");
        JsonNode analyzer = analysis.path("analyzer").path("lounge_korean");
        String tokenizer = analyzer.path("tokenizer").asText();

        assertEquals("nori_tokenizer", analysis.path("tokenizer").path(tokenizer).path("type").asText());
        List<String> filters = new ObjectMapper().convertValue(analyzer.path("filter"), List.class);
        assertTrue(filters.contains("nori_part_of_speech"), filters.toString());
    }

    @Test
    @DisplayName("제목·본문은 lounge_korean으로 나누고, 카테고리·상태는 그대로(keyword) 둔다")
    void mappings() throws Exception {
        JsonNode mappings = json().path("mappings");
        JsonNode properties = mappings.path("properties");

        assertEquals("strict", mappings.path("dynamic").asText());
        assertEquals(Set.of("postId", "title", "content", "categoryCode", "statusCode", "userId", "createdAt"),
                Set.copyOf(new ObjectMapper().convertValue(properties, java.util.Map.class).keySet()));
        assertEquals("lounge_korean", properties.path("title").path("analyzer").asText());
        assertEquals("lounge_korean", properties.path("content").path("analyzer").asText());
        assertEquals("keyword", properties.path("categoryCode").path("type").asText());
        assertEquals("keyword", properties.path("statusCode").path("type").asText());
    }
}
