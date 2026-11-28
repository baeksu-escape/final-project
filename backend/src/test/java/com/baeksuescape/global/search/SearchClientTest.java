package com.baeksuescape.global.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * FP-305 SearchClient 호출 테스트 — JDK에 들어 있는 HttpServer로 Elasticsearch 응답을 흉내 낸다(실제 ES 없이, OpenAiClientTest와 같은 방식).
 * 버전 읽기, 색인 있음·없음, 색인 만들기 요청, 4xx·5xx·연결 실패·모양이 다른 응답이면 SearchUnavailableException을 본다.
 */
class SearchClientTest {

    private HttpServer server;
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicReference<String> body = new AtomicReference<>("{}");
    private final AtomicReference<String> receivedMethod = new AtomicReference<>();
    private final AtomicReference<String> receivedPath = new AtomicReference<>();
    private final AtomicReference<String> receivedType = new AtomicReference<>();
    private final AtomicReference<String> receivedBody = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/", exchange -> {
            receivedMethod.set(exchange.getRequestMethod());
            receivedPath.set(exchange.getRequestURI().getPath());
            receivedType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            receivedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            if ("HEAD".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(status.get(), -1);
                exchange.close();
                return;
            }
            byte[] bytes = body.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status.get(), bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private SearchClient client() {
        SearchProperties properties = new SearchProperties();
        properties.setUrl("http://localhost:" + server.getAddress().getPort() + "/");
        return new SearchClient(properties);
    }

    @Test
    @DisplayName("GET / 응답의 version.number를 돌려준다")
    void serverVersion() {
        body.set("{\"name\":\"dev\",\"version\":{\"number\":\"8.10.4\"},\"tagline\":\"You Know, for Search\"}");

        assertEquals("8.10.4", client().serverVersion());
        assertEquals("GET", receivedMethod.get());
        assertEquals("/", receivedPath.get());
    }

    @Test
    @DisplayName("응답에 버전이 없으면 SearchUnavailableException")
    void serverVersionWithoutVersion() {
        body.set("{\"name\":\"not-elasticsearch\"}");

        assertThrows(SearchUnavailableException.class, () -> client().serverVersion());
    }

    @Test
    @DisplayName("HEAD /{색인}이 200이면 있음, 404면 없음")
    void indexExists() {
        status.set(200);
        assertTrue(client().indexExists("lounge_posts"));
        assertEquals("HEAD", receivedMethod.get());
        assertEquals("/lounge_posts", receivedPath.get());

        status.set(404);
        assertFalse(client().indexExists("lounge_posts"));
    }

    @Test
    @DisplayName("색인 확인이 404 말고 다른 오류(500)면 SearchUnavailableException")
    void indexExistsServerError() {
        status.set(500);

        assertThrows(SearchUnavailableException.class, () -> client().indexExists("lounge_posts"));
    }

    @Test
    @DisplayName("색인 만들기는 PUT /{색인}에 설정 JSON을 그대로 보낸다")
    void createIndex() {
        body.set("{\"acknowledged\":true,\"index\":\"lounge_posts\"}");
        String settings = "{\"settings\":{\"number_of_shards\":1}}";

        client().createIndex("lounge_posts", settings);

        assertEquals("PUT", receivedMethod.get());
        assertEquals("/lounge_posts", receivedPath.get());
        assertTrue(receivedType.get().startsWith("application/json"), receivedType.get());
        assertEquals(settings, receivedBody.get());
    }

    @Test
    @DisplayName("색인 만들기가 400(설정 오류·nori 미설치 등)이면 SearchUnavailableException")
    void createIndexRejected() {
        status.set(400);
        body.set("{\"error\":{\"type\":\"illegal_argument_exception\"}}");

        assertThrows(SearchUnavailableException.class, () -> client().createIndex("lounge_posts", "{}"));
    }

    @Test
    @DisplayName("서버가 꺼져 있으면(연결 실패) SearchUnavailableException")
    void connectionRefused() {
        SearchClient client = client();
        server.stop(0);

        assertThrows(SearchUnavailableException.class, client::serverVersion);
        assertThrows(SearchUnavailableException.class, () -> client.indexExists("lounge_posts"));
    }

    @Test
    @DisplayName("주소가 비어 있으면 http://localhost:9200, 끝의 /는 뗀다")
    void resolvedUrl() {
        SearchProperties properties = new SearchProperties();
        assertEquals("http://localhost:9200", properties.resolvedUrl());
        properties.setUrl(" http://es:9200/ ");
        assertEquals("http://es:9200", properties.resolvedUrl());
        assertFalse(properties.isEnabled());
    }
}
