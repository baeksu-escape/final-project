package com.baeksuescape.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.baeksuescape.notification.dto.NotificationCreatedEvent;
import com.baeksuescape.notification.dto.NotificationItemResponse;

/** FP-284·D-23 SSE 연결 등록·알림 전달·연결 상한·실패 정리를 가짜 연결로 확인한다(실제 HTTP 없음). */
class NotificationStreamServiceTest {
    private NotificationStreamService service;
    private final List<RecordingEmitter> created = new ArrayList<>();

    @BeforeEach
    void setUp() {
        created.clear();
        service = new NotificationStreamService() {
            @Override
            SseEmitter newEmitter(long timeoutMillis) {
                RecordingEmitter emitter = new RecordingEmitter(timeoutMillis);
                created.add(emitter);
                return emitter;
            }
        };
    }

    // D-23 FP-284 만료 예약을 사용한 시험의 백그라운드 실행기를 정리한다.
    @AfterEach
    void stopExecutors() {
        service.stop();
    }

    @Test
    @DisplayName("연결을 등록하면 connected 이벤트를 바로 보낸다")
    void register_sendsConnected() {
        service.register(7L);

        assertEquals(1, service.connectionCount(7L));
        assertTrue(created.get(0).sent.get(0).contains("connected"));
    }

    @Test
    @DisplayName("알림 이벤트는 받는 회원의 모든 탭에만 notification으로 전달한다")
    void event_deliveredToAllTabsOfUserOnly() {
        service.register(7L);
        service.register(7L);
        service.register(8L);

        service.onNotificationCreated(new NotificationCreatedEvent(7L, item(31)));

        assertTrue(created.get(0).sent.stream().anyMatch(s -> s.contains("notification") && s.contains("31")));
        assertTrue(created.get(1).sent.stream().anyMatch(s -> s.contains("notification") && s.contains("31")));
        assertFalse(created.get(2).sent.stream().anyMatch(s -> s.contains("notification")));
    }

    @Test
    @DisplayName("연결이 상한(5개)을 넘으면 가장 오래된 연결을 닫는다")
    void limit_closesOldest() {
        for (int i = 0; i < NotificationStreamService.MAX_CONNECTIONS_PER_USER + 1; i++) service.register(7L);

        assertEquals(NotificationStreamService.MAX_CONNECTIONS_PER_USER, service.connectionCount(7L));
        assertTrue(created.get(0).completed, "가장 먼저 연 연결이 닫혀야 한다.");
        String replacementEvent = String.join("", created.get(0).sent);
        assertTrue(replacementEvent.contains("event:replaced") && replacementEvent.contains("limit"), replacementEvent);
        assertFalse(created.get(1).completed);
    }

    // D-23 FP-284 토큰 만료 시 제한 시간 안에 expired 이벤트를 보내고 연결이 제거되는지 확인한다.
    @Test
    @DisplayName("토큰 만료 시 expired 이벤트를 보내고 연결을 닫는다")
    void tokenExpiry_sendsExpiredAndCloses() {
        Instant expiresAt = Instant.now().plusSeconds(60);
        service.register(7L, expiresAt);

        service.expire(7L, created.get(0));

        assertTrue(created.get(0).timeoutMillis <= 61_000);
        String expiredEvent = String.join("", created.get(0).sent);
        assertTrue(expiredEvent.contains("event:expired") && expiredEvent.contains("token"), expiredEvent);
        assertTrue(created.get(0).completed);
        assertEquals(0, service.connectionCount(7L));
    }

    @Test
    @DisplayName("보내기에 실패한 연결은 닫고 목록에서 빼며, 다른 연결은 그대로 둔다")
    void sendFailure_cleansUpOnlyThatConnection() {
        service.register(7L);
        service.register(7L);
        created.get(0).failSend = true;

        service.onNotificationCreated(new NotificationCreatedEvent(7L, item(32)));

        assertEquals(1, service.connectionCount(7L));
        assertTrue(created.get(0).completed);
        assertTrue(created.get(1).sent.stream().anyMatch(s -> s.contains("32")));
    }

    // D-23 FP-284 한 연결의 지연 전송 중에도 다른 연결의 하트비트와 실패 정리가 진행되는지 확인한다.
    @Test
    @DisplayName("하트비트는 모든 연결에 ping 주석을 보내고, 실패한 연결은 정리한다")
    void heartbeat_slowConnectionDoesNotBlockOthers() throws Exception {
        service.register(7L);
        service.register(7L);
        service.register(7L);
        created.get(0).blockSend = true;
        created.get(2).failSend = true;
        service.startHeartbeat();

        service.sendHeartbeat();

        assertTrue(created.get(0).sendEntered.await(1, TimeUnit.SECONDS));
        assertTrue(created.get(1).pingSent.await(1, TimeUnit.SECONDS));
        assertTrue(created.get(2).completedSignal.await(1, TimeUnit.SECONDS));
        created.get(0).releaseSend.countDown();
        assertTrue(created.get(0).pingSent.await(1, TimeUnit.SECONDS));
        assertEquals(2, service.connectionCount(7L));
    }

    @Test
    @DisplayName("연결이 없는 회원의 알림 이벤트는 조용히 넘어간다")
    void event_withoutConnection_isIgnored() {
        service.onNotificationCreated(new NotificationCreatedEvent(99L, item(1)));

        assertEquals(0, service.connectionCount(99L));
    }

    private NotificationItemResponse item(long id) {
        return new NotificationItemResponse(id, "WELCOME", "환영", "시작해 보세요", "/home", false, LocalDateTime.of(2026, 11, 27, 10, 0));
    }

    /** D-23 FP-284 SSE 이벤트 형식과 종료를 기록하는 테스트용 가짜 연결이다. */
    private static class RecordingEmitter extends SseEmitter {
        final List<String> sent = new ArrayList<>();
        final long timeoutMillis;
        final CountDownLatch sendEntered = new CountDownLatch(1);
        final CountDownLatch releaseSend = new CountDownLatch(1);
        final CountDownLatch pingSent = new CountDownLatch(1);
        final CountDownLatch completedSignal = new CountDownLatch(1);
        boolean blockSend;
        boolean failSend;
        boolean completed;

        RecordingEmitter(long timeout) {
            super(timeout);
            timeoutMillis = timeout;
        }

        // D-23 FP-284 느린 연결을 막아 두고 다른 emitter의 ping·정리가 진행되는지 가짜 연결에서 확인한다.
        @Override
        public synchronized void send(SseEventBuilder builder) throws IOException {
            if (blockSend) {
                sendEntered.countDown();
                try {
                    releaseSend.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException("전송 대기 중단", e);
                }
            }
            if (failSend) throw new IOException("끊긴 연결");
            builder.build().forEach(part -> {
                String value = String.valueOf(part.getData());
                sent.add(value);
                if (value.contains("ping")) pingSent.countDown();
            });
        }

        // D-23 FP-284 종료 신호를 남겨 비동기 연결 정리 완료를 시험에서 기다릴 수 있게 한다.
        @Override
        public synchronized void complete() {
            completed = true;
            completedSignal.countDown();
        }
    }
}
