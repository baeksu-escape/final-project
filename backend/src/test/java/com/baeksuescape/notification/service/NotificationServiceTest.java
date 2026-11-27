package com.baeksuescape.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.Executor;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.notification.dto.NotificationCreatedEvent;
import com.baeksuescape.notification.dto.NotificationRow;
import com.baeksuescape.notification.mapper.NotificationMapper;

import static org.mockito.Mockito.mock;

/** FP-284·D-23 알림 목록·읽음·생성 규칙을 매퍼와 분리해 검증한다. */
class NotificationServiceTest {
    private NotificationMapper mapper;
    private ApplicationEventPublisher eventPublisher;
    private NotificationService service;
    private Executor executor;
    private TransactionTemplate transactionTemplate;
    private Clock clock;

    @Test
    @DisplayName("알림 저장 실패를 삼켜 원래 처리를 계속한다")
    void notifyQuietly_swallowsCreateFailure() {
        given(mapper.insert(any())).willThrow(new IllegalStateException("database failure"));
        doAnswer(invocation -> { ((Runnable) invocation.getArgument(0)).run(); return null; })
                .when(executor).execute(any(Runnable.class));

        org.assertj.core.api.Assertions.assertThatCode(() -> service.notifyQuietly(7L, "WELCOME", "환영", "시작", "/data-input"))
                .doesNotThrowAnyException();
    }

    // FP-301·D-23 요청 커밋 뒤에는 실행기에만 넘기고, 요청 콜백 안에서는 저장하지 않는지 확인한다.
    @Test
    @DisplayName("커밋 뒤 알림 저장을 실행기에 넘긴다")
    void notifyQuietly_커밋뒤실행기로위임() {
        given(mapper.insert(any())).willAnswer(invocation -> {
            NotificationRow row = invocation.getArgument(0);
            row.setNotificationId(31L);
            return 1;
        });
        doAnswer(invocation -> { ((Runnable) invocation.getArgument(0)).run(); return null; })
                .when(executor).execute(any(Runnable.class));
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.notifyQuietly(7L, "WELCOME", "환영", "시작해 보세요", "/data-input");

            verify(executor, never()).execute(any(Runnable.class));
            verify(mapper, never()).insert(any());
            TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);

            verify(executor).execute(any(Runnable.class));
            verify(mapper).insert(any());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // FP-301·D-23 풀 크기보다 많은 알림 제출도 큐 등록 뒤 요청 호출자를 붙들지 않는지 확인한다.
    @Test
    @DisplayName("여러 알림 작업을 요청 스레드에서 기다리지 않고 제출한다")
    void notifyQuietly_다수작업즉시제출() {
        for (int i = 0; i < 20; i++) {
            service.notifyQuietly(7L, "WELCOME", "환영", "시작해 보세요", "/data-input");
        }

        verify(executor, times(20)).execute(any(Runnable.class));
        verify(mapper, never()).insert(any());
    }

    // FP-301·D-23 큐 포화 거부가 가입 등 원래 처리를 실패시키지 않는지 확인한다.
    @Test
    @DisplayName("실행기 큐가 가득 차도 알림 실패를 호출자에게 전파하지 않는다")
    void notifyQuietly_실행기거부삼킴() {
        doThrow(new TaskRejectedException("queue full")).when(executor).execute(any(Runnable.class));

        assertThatCode(() -> service.notifyQuietly(7L, "WELCOME", "환영", "시작해 보세요", "/data-input"))
                .doesNotThrowAnyException();
        verify(mapper, never()).insert(any());
    }

    // D-23 FP-301 작은 알림 실행기가 막혀 있어도 호출 작업은 빠르게 반환하고 큐 초과는 예외로 번지지 않는지 확인한다.
    @Test
    @DisplayName("실행기 큐가 차도 여러 알림 요청을 빠르게 반환한다")
    void notifyQuietly_실제실행기포화시빠른반환() throws Exception {
        ThreadPoolTaskExecutor smallExecutor = new ThreadPoolTaskExecutor();
        smallExecutor.setCorePoolSize(1);
        smallExecutor.setMaxPoolSize(1);
        smallExecutor.setQueueCapacity(2);
        smallExecutor.initialize();
        CountDownLatch workerStarted = new CountDownLatch(1);
        CountDownLatch releaseWorker = new CountDownLatch(1);
        TransactionTemplate blockedTransaction = mock(TransactionTemplate.class);
        doAnswer(invocation -> {
            workerStarted.countDown();
            releaseWorker.await(5, TimeUnit.SECONDS);
            return null;
        }).when(blockedTransaction).execute(any(TransactionCallback.class));
        NotificationService asyncService = new NotificationService(mapper, eventPublisher, blockedTransaction,
                smallExecutor, clock);
        ExecutorService callers = Executors.newFixedThreadPool(50);

        try {
            asyncService.notifyQuietly(7L, "WELCOME", "환영", "시작", "/data-input");
            assertThat(workerStarted.await(1, TimeUnit.SECONDS)).isTrue();
            List<Future<Long>> elapsedMillis = new java.util.ArrayList<>();
            for (int i = 0; i < 50; i++) {
                elapsedMillis.add(callers.submit(() -> {
                    long startedAt = System.nanoTime();
                    asyncService.notifyQuietly(7L, "WELCOME", "환영", "시작", "/data-input");
                    return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
                }));
            }
            for (Future<Long> result : elapsedMillis) {
                assertThat(result.get(1, TimeUnit.SECONDS)).isLessThan(100L);
            }
        } finally {
            releaseWorker.countDown();
            callers.shutdownNow();
            smallExecutor.getThreadPoolExecutor().shutdown();
            smallExecutor.getThreadPoolExecutor().awaitTermination(5, TimeUnit.SECONDS);
        }
    }
    @BeforeEach
    void setUp() {
        mapper = mock(NotificationMapper.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        executor = mock(Executor.class);
        clock = Clock.fixed(Instant.parse("2026-11-27T10:00:00Z"), ZoneOffset.UTC);
        transactionTemplate = mock(TransactionTemplate.class);
        doAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        }).when(transactionTemplate).execute(any());
        service = new NotificationService(mapper, eventPublisher, transactionTemplate, executor, clock);
    }

    @Test
    @DisplayName("최근 20건과 전체 안 읽은 수를 반환한다")
    void list_latestTwentyAndUnreadCount() {
        LocalDateTime now = LocalDateTime.now();
        NotificationRow row = row(31L, 7L, null, now);
        given(mapper.selectLatest(7L, 20)).willReturn(List.of(row));
        given(mapper.countUnread(7L)).willReturn(4L);

        var result = service.list(7L);

        assertThat(result.unreadCount()).isEqualTo(4);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).notificationId()).isEqualTo(31L);
        assertThat(result.items().get(0).read()).isFalse();
    }


    // FP-300·D-23 필터·커서 페이지 조회와 hasMore 계산을 확인한다.
    @Test
    @DisplayName("목록에 읽음·종류·커서 조건을 적용하고 다음 페이지 여부를 계산한다")
    void 목록_조건_커서_크기_다음페이지여부() {
        LocalDateTime now = LocalDateTime.now();
        given(mapper.selectFiltered(7L, true, "COMMENT_NEW", 50L, 3))
                .willReturn(List.of(row(49L, 7L, null, now), row(48L, 7L, null, now.minusMinutes(1)),
                        row(47L, 7L, null, now.minusMinutes(2))));
        given(mapper.countUnread(7L)).willReturn(4L);

        var result = service.list(7L, true, "COMMENT_NEW", 50L, 2);

        assertThat(result.unreadCount()).isEqualTo(4);
        assertThat(result.items()).extracting(com.baeksuescape.notification.dto.NotificationItemResponse::notificationId)
                .containsExactly(49L, 48L);
        assertThat(result.hasMore()).isTrue();
        verify(mapper).selectFiltered(7L, true, "COMMENT_NEW", 50L, 3);
    }

    // FP-300·D-23 허용되지 않은 알림 종류의 400 검증을 확인한다.
    @Test
    @DisplayName("지원하지 않는 알림 종류는 400으로 거부한다")
    void 목록_잘못된종류_거부() {
        assertThatThrownBy(() -> service.list(7L, false, "UNKNOWN", null, 20))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
    @Test
    @DisplayName("본인 안 읽은 알림을 읽음 처리한다")
    void markRead_ownedNotification() {
        given(mapper.markRead(eq(7L), eq(31L), any())).willReturn(1);
        service.markRead(7L, 31L);
        verify(mapper).markRead(eq(7L), eq(31L), eq(LocalDateTime.now(clock)));
    }

    @Test
    @DisplayName("남의 알림과 없는 알림은 NOT_FOUND로 거부한다")
    void markRead_otherOrMissingNotification_notFound() {
        given(mapper.markRead(eq(7L), eq(31L), any())).willReturn(0);
        given(mapper.selectOwned(7L, 31L)).willReturn(null);

        assertThatThrownBy(() -> service.markRead(7L, 31L)).isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("이미 읽은 본인 알림은 성공으로 유지한다")
    void markRead_alreadyRead_isSuccess() {
        given(mapper.markRead(eq(7L), eq(31L), any())).willReturn(0);
        given(mapper.selectOwned(7L, 31L)).willReturn(row(31L, 7L, LocalDateTime.now(), LocalDateTime.now()));
        service.markRead(7L, 31L);
        verify(mapper).selectOwned(7L, 31L);
    }

    @Test
    @DisplayName("본인 전체 읽음 처리 건수를 반환한다")
    void markAllRead_returnsUpdatedCount() {
        given(mapper.markAllRead(eq(7L), any())).willReturn(3);
        assertThat(service.markAllRead(7L)).isEqualTo(3);
        verify(mapper).markAllRead(eq(7L), eq(LocalDateTime.now(clock)));
    }

    @Test
    @DisplayName("유효한 알림은 저장 후 생성 이벤트를 발행한다")
    void create_valid_persistsAndPublishesEvent() {
        given(mapper.insert(any())).willAnswer(invocation -> {
            NotificationRow row = invocation.getArgument(0);
            row.setNotificationId(31L);
            return 1;
        });

        var result = service.create(7L, "WELCOME", "환영합니다", "알림 설정을 확인해 주세요.", "/mypage");

        assertThat(result.notificationId()).isEqualTo(31L);
        assertThat(result.read()).isFalse();
        assertThat(result.createdAt()).isEqualTo(LocalDateTime.now(clock));
        verify(eventPublisher).publishEvent(any(NotificationCreatedEvent.class));
    }

    @Test
    @DisplayName("알림 종류·필수 내용·길이·내부 경로만 허용한다")
    void create_invalidInput_rejected() {
        assertInvalid("UNKNOWN", "제목", "내용", "/home");
        assertInvalid("WELCOME", " ", "내용", "/home");
        assertInvalid("WELCOME", "x".repeat(201), "내용", "/home");
        assertInvalid("WELCOME", "제목", "x".repeat(1001), "/home");
        assertInvalid("WELCOME", "제목", "내용", "https://example.com");
        assertInvalid("WELCOME", "제목", "내용", "//example.com");
        assertInvalid("WELCOME", "제목", "내용", "/\t/evil.com");
        verify(mapper, never()).insert(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    private void assertInvalid(String type, String title, String content, String link) {
        assertThatThrownBy(() -> service.create(7L, type, title, content, link))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    private NotificationRow row(long id, long userId, LocalDateTime readAt, LocalDateTime createdAt) {
        NotificationRow row = new NotificationRow();
        row.setNotificationId(id);
        row.setUserId(userId);
        row.setTypeCode("WELCOME");
        row.setTitle("환영합니다");
        row.setContent("서비스를 시작해 보세요.");
        row.setLinkUrl("/home");
        row.setReadAt(readAt);
        row.setCreatedAt(createdAt);
        return row;
    }
}
