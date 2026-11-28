package com.baeksuescape.global.search;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * FP-305 SearchIndexInitializer 테스트 — 꺼져 있으면 아무것도 부르지 않고, 켜져 있으면 없는 색인만 만들며,
 * Elasticsearch가 없거나 설정 파일이 없어도 서버가 멈추지 않는지(예외 없이 경고만) 본다.
 */
class SearchIndexInitializerTest {

    private static final SearchIndexDefinition LOUNGE = new SearchIndexDefinition("lounge_posts", "search/lounge-posts.json");

    private final SearchClient client = mock(SearchClient.class);

    private SearchIndexInitializer initializer(boolean enabled, SearchIndexDefinition... indexes) {
        SearchProperties properties = new SearchProperties();
        properties.setEnabled(enabled);
        return new SearchIndexInitializer(properties, client, List.of(indexes));
    }

    @Test
    @DisplayName("꺼져 있으면(기본) Elasticsearch를 전혀 부르지 않는다")
    void disabled() {
        initializer(false, LOUNGE).initialize();

        verifyNoInteractions(client);
    }

    @Test
    @DisplayName("켜져 있고 색인이 없으면 JSON 파일 내용으로 만든다")
    void createsMissingIndex() {
        when(client.serverVersion()).thenReturn("8.10.4");
        when(client.indexExists("lounge_posts")).thenReturn(false);

        initializer(true, LOUNGE).initialize();

        verify(client).createIndex("lounge_posts", LOUNGE.readJson());
    }

    @Test
    @DisplayName("색인이 이미 있으면 다시 만들지 않는다(서버를 다시 켜도 글이 지워지지 않게)")
    void keepsExistingIndex() {
        when(client.serverVersion()).thenReturn("8.10.4");
        when(client.indexExists("lounge_posts")).thenReturn(true);

        initializer(true, LOUNGE).initialize();

        verify(client, never()).createIndex(anyString(), anyString());
    }

    @Test
    @DisplayName("버전이 팀 기준과 달라도 멈추지 않고 색인 준비를 이어 간다(경고만)")
    void otherVersion() {
        when(client.serverVersion()).thenReturn("8.11.1");
        when(client.indexExists("lounge_posts")).thenReturn(false);

        initializer(true, LOUNGE).initialize();

        verify(client).createIndex(eq("lounge_posts"), anyString());
    }

    @Test
    @DisplayName("Elasticsearch가 없으면 예외 없이 끝나고 색인 확인도 하지 않는다")
    void serverDown() {
        when(client.serverVersion()).thenThrow(new SearchUnavailableException("연결 안 됨"));

        assertDoesNotThrow(() -> initializer(true, LOUNGE).initialize());
        verify(client, never()).indexExists(anyString());
    }

    @Test
    @DisplayName("설정 파일이 없으면 예외 없이 끝난다(경고만)")
    void missingResource() {
        when(client.serverVersion()).thenReturn("8.10.4");
        when(client.indexExists("broken")).thenReturn(false);

        assertDoesNotThrow(() -> initializer(true, new SearchIndexDefinition("broken", "search/no-such-file.json")).initialize());
        verify(client, never()).createIndex(anyString(), anyString());
    }
}
