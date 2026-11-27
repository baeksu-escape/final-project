package com.baeksuescape.help.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.baeksuescape.global.exception.ApiException;
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
import org.springframework.http.HttpStatus;

/**
 * FP-181 OpenAiClient 호출 테스트 — JDK에 들어 있는 HttpServer로 OpenAI 응답을 흉내 낸다(새 라이브러리 없음, 실제 키·실제 호출 없음).
 * 정상 답 꺼내기, 보낸 경로·헤더·본문, 키 없음 503, 4xx·5xx·시간 초과·빈 답 502를 본다.
 */
class OpenAiClientTest {

    private static final String TEST_KEY = "test-key-not-real";

    private HttpServer server;
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicReference<String> body = new AtomicReference<>("{}");
    private final AtomicReference<Long> delayMillis = new AtomicReference<>(0L);
    private final AtomicReference<String> receivedPath = new AtomicReference<>();
    private final AtomicReference<String> receivedAuth = new AtomicReference<>();
    private final AtomicReference<String> receivedBody = new AtomicReference<>();
    private final AtomicInteger calls = new AtomicInteger();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/", exchange -> {
            calls.incrementAndGet();
            receivedPath.set(exchange.getRequestURI().getPath());
            receivedAuth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            receivedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            try {
                Thread.sleep(delayMillis.get());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            byte[] bytes = body.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
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

    private OpenAiClient client(String apiKey, int readTimeoutMillis) {
        OpenAiProperties properties = new OpenAiProperties();
        properties.setApiKey(apiKey);
        properties.setBaseUrl("http://localhost:" + server.getAddress().getPort() + "/v1/");
        properties.setReadTimeoutMillis(readTimeoutMillis);
        return new OpenAiClient(properties);
    }

    private static String answer(String content) {
        return "{\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"" + content + "\"}}]}";
    }

    @Test
    @DisplayName("200이면 /v1/chat/completions로 Bearer 키와 모델·지시·글을 보내고 첫 답의 앞뒤 공백을 떼어 돌려준다")
    void ok() {
        body.set(answer("  DSR은 소득 중 빚 갚는 비율입니다. "));

        String result = client(TEST_KEY, 3000).complete("지시 문장", "DSR이 뭐예요?", 400);

        assertEquals("DSR은 소득 중 빚 갚는 비율입니다.", result);
        assertEquals("/v1/chat/completions", receivedPath.get());
        assertEquals("Bearer " + TEST_KEY, receivedAuth.get());
        assertTrue(receivedBody.get().contains("\"model\":\"gpt-5.6-luna\""), receivedBody.get());
        assertTrue(receivedBody.get().contains("\"max_completion_tokens\":400"), receivedBody.get());
        assertTrue(receivedBody.get().contains("DSR이 뭐예요?"));
        assertTrue(receivedBody.get().contains("지시 문장"));
    }

    @Test
    @DisplayName("키가 비어 있으면 enabled false이고, 부르면 503 AI_UNAVAILABLE이며 서버에 요청하지 않는다")
    void noKey() {
        for (String key : new String[] {null, "", "   "}) {
            OpenAiClient client = client(key, 3000);
            assertFalse(client.enabled());
            ApiException error = assertThrows(ApiException.class, () -> client.complete("지시", "질문", 100));
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatus());
            assertEquals(OpenAiClient.AI_UNAVAILABLE, error.getCode());
        }
        assertEquals(0, calls.get());
    }

    @Test
    @DisplayName("401(키 오류)·429(한도)·500은 모두 502 AI_FAILED로 바뀐다")
    void httpErrors() {
        body.set("{\"error\":{\"message\":\"nope\"}}");
        for (int code : new int[] {401, 429, 500}) {
            status.set(code);
            ApiException error = assertThrows(ApiException.class, () -> client(TEST_KEY, 3000).complete("지시", "질문", 100));
            assertEquals(HttpStatus.BAD_GATEWAY, error.getStatus(), "status " + code);
            assertEquals(OpenAiClient.AI_FAILED, error.getCode());
        }
    }

    @Test
    @DisplayName("응답 시간 제한을 넘기면 502 AI_FAILED")
    void timeout() {
        delayMillis.set(600L);
        body.set(answer("늦은 답"));

        ApiException error = assertThrows(ApiException.class, () -> client(TEST_KEY, 200).complete("지시", "질문", 100));

        assertEquals(OpenAiClient.AI_FAILED, error.getCode());
    }

    @Test
    @DisplayName("choices가 비었거나 content가 공백이면 502 AI_FAILED")
    void emptyAnswer() {
        for (String empty : new String[] {"{\"choices\":[]}", answer("   "), "{}"}) {
            body.set(empty);
            ApiException error = assertThrows(ApiException.class, () -> client(TEST_KEY, 3000).complete("지시", "질문", 100));
            assertEquals(OpenAiClient.AI_FAILED, error.getCode(), empty);
        }
    }

    @Test
    @DisplayName("finish_reason이 length(토큰 상한에서 잘림)면 502 AI_FAILED, stop이면 정상 답이다(PR #170 리뷰)")
    void truncatedAnswer() {
        body.set("{\"choices\":[{\"index\":0,\"finish_reason\":\"length\",\"message\":{\"role\":\"assistant\",\"content\":\"중간에 끊긴\"}}]}");
        ApiException error = assertThrows(ApiException.class, () -> client(TEST_KEY, 3000).complete("지시", "질문", 100));
        assertEquals(OpenAiClient.AI_FAILED, error.getCode());

        body.set("{\"choices\":[{\"index\":0,\"finish_reason\":\"stop\",\"message\":{\"role\":\"assistant\",\"content\":\"끝까지 쓴 답\"}}]}");
        assertEquals("끝까지 쓴 답", client(TEST_KEY, 3000).complete("지시", "질문", 100));
    }

    @Test
    @DisplayName("설정이 비면 기본 주소·기본 모델을 쓰고, 주소 끝의 / 는 뗀다")
    void defaults() {
        OpenAiProperties properties = new OpenAiProperties();
        assertNull(properties.getApiKey());
        assertEquals("https://api.openai.com/v1", properties.resolvedBaseUrl());
        assertEquals("gpt-5.6-luna", properties.resolvedModel());
        properties.setBaseUrl("http://x/v1/");
        properties.setModel(" gpt-test ");
        assertEquals("http://x/v1", properties.resolvedBaseUrl());
        assertEquals("gpt-test", properties.resolvedModel());
    }
}
