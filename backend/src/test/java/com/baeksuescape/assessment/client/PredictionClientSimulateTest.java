package com.baeksuescape.assessment.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.baeksuescape.assessment.client.PredictionClient.SimulationFailedException;
import com.sun.net.httpserver.HttpServer;

/**
 * FP-170 PredictionClient.simulate(ML-04) 호출 테스트 — JDK에 들어 있는 HttpServer로 FastAPI 응답을 흉내 낸다(새 라이브러리 없음).
 * 200은 본문 그대로, 4xx는 FastAPI 오류 본문의 code·fieldErrors, 연결 실패·5xx·시간 초과는 503 MODEL_NOT_READY로 바뀌는지 본다.
 */
class PredictionClientSimulateTest {

    private HttpServer server;
    private final AtomicReference<Integer> status = new AtomicReference<>(200);
    private final AtomicReference<String> body = new AtomicReference<>("{}");
    private final AtomicReference<Long> delayMillis = new AtomicReference<>(0L);
    private final AtomicReference<String> receivedPath = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/", exchange -> {
            receivedPath.set(exchange.getRequestURI().getPath());
            exchange.getRequestBody().readAllBytes();
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

    private PredictionClient client(int readTimeoutMillis) {
        PredictionProperties properties = new PredictionProperties();
        properties.setBaseUrl("http://localhost:" + server.getAddress().getPort());
        properties.setReadTimeoutMillis(readTimeoutMillis);
        return new PredictionClient(properties);
    }

    private static Map<String, Object> request() {
        return Map.of("requestId", "11111111-2222-4333-8444-555555555555", "changes", Map.of());
    }

    @Test
    @DisplayName("200이면 ML-04 경로로 보내고 응답 본문을 그대로 돌려준다")
    void ok() {
        body.set("{\"modelVersion\":\"DEV-DUMMY\",\"before\":{\"score\":588},\"after\":{\"score\":618}}");

        Map<String, Object> result = client(3000).simulate(request());

        assertEquals("/v1/assessments/simulate", receivedPath.get());
        assertEquals("DEV-DUMMY", result.get("modelVersion"));
    }

    @Test
    @DisplayName("422면 상태 422, code INVALID_INPUT, fieldErrors를 담는다")
    void unprocessable() {
        status.set(422);
        body.set("{\"code\":\"INVALID_INPUT\",\"message\":\"입력값을 확인해 주세요.\","
                + "\"fieldErrors\":[{\"field\":\"changes.CARD_LIMIT_AMT\",\"message\":\"카드 한도와 월 카드 사용액은 함께 보내야 합니다.\"}],"
                + "\"requestId\":\"x\"}");

        SimulationFailedException e = assertThrows(SimulationFailedException.class, () -> client(3000).simulate(request()));

        assertEquals(422, e.getStatus());
        assertEquals("INVALID_INPUT", e.getCode());
        assertEquals(1, e.getFieldErrors().size());
        assertEquals("changes.CARD_LIMIT_AMT", e.getFieldErrors().get(0).field());
    }

    @Test
    @DisplayName("409면 상태 409, code VERSION_MISMATCH")
    void versionMismatch() {
        status.set(409);
        body.set("{\"code\":\"VERSION_MISMATCH\",\"message\":\"모르는 모델 버전입니다.\",\"fieldErrors\":[]}");

        SimulationFailedException e = assertThrows(SimulationFailedException.class, () -> client(3000).simulate(request()));

        assertEquals(409, e.getStatus());
        assertEquals("VERSION_MISMATCH", e.getCode());
    }

    @Test
    @DisplayName("503·500은 모두 503 MODEL_NOT_READY")
    void serverErrors() {
        status.set(503);
        body.set("{\"code\":\"MODEL_NOT_READY\",\"message\":\"모델을 아직 불러오지 못했습니다.\"}");
        SimulationFailedException notReady = assertThrows(SimulationFailedException.class, () -> client(3000).simulate(request()));
        assertEquals(503, notReady.getStatus());
        assertEquals("MODEL_NOT_READY", notReady.getCode());

        status.set(500);
        body.set("{\"code\":\"INTERNAL_ERROR\"}");
        SimulationFailedException internal = assertThrows(SimulationFailedException.class, () -> client(3000).simulate(request()));
        assertEquals(503, internal.getStatus());
        assertEquals("MODEL_NOT_READY", internal.getCode());
    }

    @Test
    @DisplayName("응답 시간 초과·연결 실패도 503 MODEL_NOT_READY")
    void timeoutAndConnectionFailure() throws IOException {
        delayMillis.set(500L);
        SimulationFailedException timeout = assertThrows(SimulationFailedException.class, () -> client(100).simulate(request()));
        assertEquals(503, timeout.getStatus());

        // 잠깐 열었다 닫은 포트 = 아무도 듣지 않는 주소
        HttpServer closedServer = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        int closedPort = closedServer.getAddress().getPort();
        closedServer.stop(0);
        PredictionProperties properties = new PredictionProperties();
        properties.setBaseUrl("http://localhost:" + closedPort);
        PredictionClient closed = new PredictionClient(properties);
        SimulationFailedException refused = assertThrows(SimulationFailedException.class, () -> closed.simulate(request()));
        assertEquals(503, refused.getStatus());
        assertTrue(refused.getFieldErrors().isEmpty());
    }
}
