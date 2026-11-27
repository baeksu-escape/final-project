package com.baeksuescape.notification.service;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.baeksuescape.notification.dto.NotificationCreatedEvent;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * FP-284·D-23 알림 SSE 연결 관리와 전달을 맡는다. 회원 한 명이 탭을 여러 개 열 수 있어 회원별로 연결 목록을 둔다.
 * 연결은 서버 메모리에만 있다(서버 한 대 전제). 끊긴 사이의 알림은 화면이 목록 API를 다시 불러 보충한다.
 */
@Service
public class NotificationStreamService {
    private static final Logger log = LoggerFactory.getLogger(NotificationStreamService.class);

    /** 연결 하나의 최대 유지 시간(밀리초). 지나면 끝나고 화면이 다시 연결한다. */
    static final long TIMEOUT_MILLIS = TimeUnit.MINUTES.toMillis(30);
    /** 프록시·공유기가 놀고 있는 연결을 끊지 않게 보내는 하트비트 간격(초). */
    static final long HEARTBEAT_SECONDS = 25;
    /** 회원 한 명의 동시 연결 상한. 넘으면 가장 오래된 연결을 닫는다. */
    static final int MAX_CONNECTIONS_PER_USER = 5;
    /** 하트비트와 연결별 전송이 한 느린 연결에 묶이지 않도록 유지할 스케줄러 작업자 수. */
    static final int SCHEDULER_THREAD_COUNT = 4;

    private final Map<Long, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final Map<SseEmitter, ScheduledFuture<?>> expirationTasks = new ConcurrentHashMap<>();
    private volatile ScheduledExecutorService heartbeatExecutor;
    // D-23 서버 종료(stop) 뒤에는 실행기를 다시 만들지 않는다.
    private volatile boolean stopped;

    /** D-23 FP-284 하트비트·토큰 만료 예약과 연결별 전송을 네 작업 스레드로 분산한다. */
    @PostConstruct
    void startHeartbeat() {
        heartbeatExecutor = Executors.newScheduledThreadPool(SCHEDULER_THREAD_COUNT, runnable -> {
            Thread thread = new Thread(runnable, "notification-sse-heartbeat");
            thread.setDaemon(true);
            return thread;
        });
        heartbeatExecutor.scheduleWithFixedDelay(this::sendHeartbeat, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    }

    /** FP-284·D-23 서버가 내려갈 때 하트비트와 만료 예약을 멈추고 남은 연결을 닫는다. */
    @PreDestroy
    void stop() {
        stopped = true;
        if (heartbeatExecutor != null) heartbeatExecutor.shutdownNow();
        emitters.values().forEach(list -> new ArrayList<>(list).forEach(this::completeQuietly));
        emitters.clear();
        expirationTasks.clear();
    }

    /** FP-284·D-23 로그인 회원의 새 SSE 연결을 등록하고 connected 이벤트를 보낸다. 상한을 넘으면 가장 오래된 연결을 닫는다. */
    public SseEmitter register(long userId) {
        return register(userId, null);
    }

    // D-23 FP-284 토큰 만료 이벤트가 먼저 전달되도록 emitter 타임아웃에는 최대 1초 여유를 둔다.
    public SseEmitter register(long userId, Instant tokenExpiresAt) {
        long timeoutMillis = tokenExpiresAt == null ? TIMEOUT_MILLIS : remainingConnectionMillis(tokenExpiresAt);
        SseEmitter emitter = newEmitter(timeoutMillis);
        List<SseEmitter> toClose = new ArrayList<>();
        emitters.compute(userId, (id, list) -> {
            List<SseEmitter> next = list == null ? new ArrayList<>() : new ArrayList<>(list);
            next.add(emitter);
            while (next.size() > MAX_CONNECTIONS_PER_USER) toClose.add(next.remove(0));
            return next;
        });
        // 끝났거나 시간이 지났거나 오류가 난 연결은 목록에서 뺀다.
        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> remove(userId, emitter));
        emitter.onError(error -> remove(userId, emitter));
        toClose.forEach(old -> {
            cancelExpiration(old);
            send(userId, old, SseEmitter.event().name("replaced").data("{\"reason\":\"limit\"}"));
            completeQuietly(old);
        });
        send(userId, emitter, SseEmitter.event().name("connected").data("ok"));
        if (tokenExpiresAt != null && !stopped && emitters.getOrDefault(userId, List.of()).contains(emitter)) {
            ensureHeartbeatExecutor();
            long delayMillis = Math.max(0, Duration.between(Instant.now(), tokenExpiresAt).toMillis());
            expirationTasks.put(emitter, heartbeatExecutor.schedule(() -> expire(userId, emitter), delayMillis,
                    TimeUnit.MILLISECONDS));
        }
        return emitter;
    }

    /** FP-284·D-23 알림 저장이 커밋된 뒤, 받는 회원의 모든 연결에 notification 이벤트로 알림 1건을 보낸다. */
    // FP-301·D-23 커밋 뒤 SSE는 알림 실행기 스레드에서 전송되어 원 요청 스레드 커넥션과 분리된다.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNotificationCreated(NotificationCreatedEvent event) {
        List<SseEmitter> targets = emitters.get(event.userId());
        if (targets == null) return;
        for (SseEmitter emitter : new ArrayList<>(targets)) {
            send(event.userId(), emitter, SseEmitter.event().id(String.valueOf(event.notification().notificationId()))
                    .name("notification").data(event.notification(), MediaType.APPLICATION_JSON));
        }
    }

    /** D-23 FP-284 연결마다 하트비트 전송을 별도 작업으로 넘겨 느린 연결이 나머지를 막지 않게 한다. */
    void sendHeartbeat() {
        // 서버 종료(stop) 뒤 실행기를 다시 만들지 않도록, 실행기가 없거나 멈췄으면 아무것도 하지 않는다.
        ScheduledExecutorService executor = heartbeatExecutor;
        if (executor == null || executor.isShutdown()) return;
        emitters.forEach((userId, list) -> {
            for (SseEmitter emitter : new ArrayList<>(list)) {
                try {
                    executor.execute(() -> send(userId, emitter, SseEmitter.event().comment("ping")));
                } catch (RejectedExecutionException e) {
                    log.debug("알림 SSE 하트비트 작업을 넘기지 못했습니다: userId={}", userId);
                }
            }
        });
    }

    // D-23 FP-284 토큰 만료 이벤트를 보낸 뒤 해당 연결만 정리해 다른 탭의 스트림은 유지한다.
    void expire(long userId, SseEmitter emitter) {
        send(userId, emitter, SseEmitter.event().name("expired").data("{\"reason\":\"token\"}"));
        remove(userId, emitter);
        completeQuietly(emitter);
    }

    // D-23 FP-284 토큰 만료 이벤트를 보낼 시간을 확보하도록 최대 연결 시간 안에서 타임아웃을 계산한다.
    long remainingConnectionMillis(Instant tokenExpiresAt) {
        if (tokenExpiresAt == null) return TIMEOUT_MILLIS;
        long remainingMillis = Math.max(1, Duration.between(Instant.now(), tokenExpiresAt).toMillis());
        return remainingMillis <= TIMEOUT_MILLIS ? remainingMillis + TimeUnit.SECONDS.toMillis(1) : TIMEOUT_MILLIS;
    }

    /** 회원의 현재 연결 수(테스트·점검용). */
    int connectionCount(long userId) {
        List<SseEmitter> list = emitters.get(userId);
        return list == null ? 0 : list.size();
    }

    /** 테스트에서 가짜 연결로 바꿀 수 있게 분리했다. */
    SseEmitter newEmitter(long timeoutMillis) {
        return new SseEmitter(timeoutMillis);
    }

    // D-23 FP-284 한 연결에 보내고 실패하면 그 연결만 닫아 목록에서 빼며 알림 저장에는 영향이 없게 한다.
    private void send(long userId, SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (IOException | RuntimeException e) {
            log.debug("알림 SSE 전송 실패, 연결을 정리합니다: userId={}", userId);
            remove(userId, emitter);
            completeQuietly(emitter);
        }
    }

    // D-23 FP-284 이미 끊긴 연결의 완료 처리 예외가 다시 호출자에게 퍼지지 않게 삼킨다.
    private void completeQuietly(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (RuntimeException ignored) {
            // 이미 종료된 연결이면 추가 예외 없이 정리한다.
        }
    }

    private void remove(long userId, SseEmitter emitter) {
        cancelExpiration(emitter);
        emitters.computeIfPresent(userId, (id, list) -> {
            List<SseEmitter> next = new ArrayList<>(list);
            next.remove(emitter);
            return next.isEmpty() ? null : next;
        });
    }

    // D-23 FP-284 연결이 먼저 닫히면 예약된 토큰 만료 작업도 취소한다.
    private void cancelExpiration(SseEmitter emitter) {
        ScheduledFuture<?> expirationTask = expirationTasks.remove(emitter);
        if (expirationTask != null) expirationTask.cancel(false);
    }

    // D-23 FP-284 토큰 만료 예약과 하트비트 전송에 필요한 다중 스레드 실행기를 준비한다.
    private void ensureHeartbeatExecutor() {
        if (!stopped && (heartbeatExecutor == null || heartbeatExecutor.isShutdown())) startHeartbeat();
    }
}
