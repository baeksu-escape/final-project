package com.baeksuescape.notification.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.notification.dto.NotificationCreatedEvent;
import com.baeksuescape.notification.dto.NotificationItemResponse;
import com.baeksuescape.notification.dto.NotificationListResponse;
import com.baeksuescape.notification.dto.NotificationRow;
import com.baeksuescape.notification.mapper.NotificationMapper;

/** FP-284·D-23 본인 알림 조회·읽음 처리와 공통 알림 생성을 맡는다. */
@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final int LIST_LIMIT = 20;
    private static final int MAX_LIST_LIMIT = 50;
    private static final Set<String> TYPE_CODES = Set.of("SCORE_NEW", "COMMENT_NEW", "REPORT_RESULT", "WELCOME");

    private final NotificationMapper notificationMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionTemplate notificationTransaction;
    private final Executor notificationExecutor;
    private final Clock clock;

    public NotificationService(NotificationMapper notificationMapper, ApplicationEventPublisher eventPublisher,
            @Qualifier("notificationTransaction") TransactionTemplate notificationTransaction,
            @Qualifier("notificationExecutor") Executor notificationExecutor, Clock clock) {
        this.notificationMapper = notificationMapper;
        this.eventPublisher = eventPublisher;
        this.notificationTransaction = notificationTransaction;
        this.notificationExecutor = notificationExecutor;
        this.clock = clock;
    }

    // FP-301·D-23 커밋 뒤 실행기에 작업을 넘겨 요청 스레드 트랜잭션과 분리하고, 큐 포화도 원 업무에 전파하지 않는다.
    public void notifyQuietly(long userId, String typeCode, String title, String content, String linkUrl) {
        Runnable submit = () -> {
            try {
                notificationExecutor.execute(() -> saveQuietly(userId, typeCode, title, content, linkUrl));
            } catch (RejectedExecutionException e) {
                log.warn("알림 생성 작업 폐기 typeCode={} userId={} exception={}", typeCode, userId, e.getClass().getSimpleName());
            } catch (RuntimeException e) {
                log.warn("알림 생성 작업 제출 실패 typeCode={} userId={} exception={}", typeCode, userId,
                        e.getClass().getSimpleName());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    submit.run();
                }
            });
        } else {
            submit.run();
        }
    }

    // FP-301·D-23 저장과 커밋 뒤 알림 생성 이벤트를 실행기 스레드에서 처리해 요청 스레드 커넥션 점유와 분리한다.
    private void saveQuietly(long userId, String typeCode, String title, String content, String linkUrl) {
        try {
            notificationTransaction.execute(status -> create(userId, typeCode, title, content, linkUrl));
        } catch (RuntimeException e) {
            log.warn("알림 생성 실패 typeCode={} userId={} exception={}", typeCode, userId, e.getClass().getSimpleName());
        }
    }
    /** FP-284·D-23 최근 20건과 회원의 안 읽은 개수를 조회한다. */
    @Transactional(readOnly = true)
    public NotificationListResponse list(long userId) {
        List<NotificationItemResponse> items = notificationMapper.selectLatest(userId, LIST_LIMIT).stream()
                .map(NotificationService::toResponse).toList();
        return new NotificationListResponse(notificationMapper.countUnread(userId), items);
    }

    // FP-300·D-23 기본 목록은 유지하면서 읽지 않음·종류·커서 조건을 적용하고 다음 페이지 유무를 계산한다.
    @Transactional(readOnly = true)
    public NotificationListResponse list(long userId, boolean unreadOnly, String typeCode, Long before, int size) {
        if (size < 1 || size > MAX_LIST_LIMIT || (typeCode != null && !TYPE_CODES.contains(typeCode))
                || (before != null && before <= 0)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "알림 목록 조건을 확인해 주세요.");
        }
        List<NotificationItemResponse> fetched = notificationMapper.selectFiltered(userId, unreadOnly, typeCode, before,
                size + 1).stream().map(NotificationService::toResponse).toList();
        boolean hasMore = fetched.size() > size;
        List<NotificationItemResponse> items = hasMore ? fetched.subList(0, size) : fetched;
        return new NotificationListResponse(notificationMapper.countUnread(userId), items, hasMore);
    }

    /** FP-284·D-23 본인 알림만 읽음 처리하고, 이미 읽었거나 존재하지 않으면 404로 응답한다. */
    @Transactional
    public void markRead(long userId, long notificationId) {
        if (notificationMapper.markRead(userId, notificationId, LocalDateTime.now(clock)) == 0
                && notificationMapper.selectOwned(userId, notificationId) == null) {
            throw notFound();
        }
    }

    /** FP-284·D-23 본인 안 읽은 알림을 모두 읽음 처리하고 변경 건수를 반환한다. */
    @Transactional
    public int markAllRead(long userId) {
        return notificationMapper.markAllRead(userId, LocalDateTime.now(clock));
    }

    /** FP-284·D-23 검증한 알림을 저장하고, 후속 SSE 전달기가 구독할 생성 이벤트를 발행한다. */
    @Transactional
    public NotificationItemResponse create(long userId, String typeCode, String title, String content, String linkUrl) {
        validate(userId, typeCode, title, content, linkUrl);
        NotificationRow row = new NotificationRow();
        row.setUserId(userId);
        row.setTypeCode(typeCode);
        row.setTitle(title);
        row.setContent(content);
        row.setLinkUrl(linkUrl);
        row.setCreatedAt(LocalDateTime.now(clock));
        notificationMapper.insert(row);
        if (row.getNotificationId() == null) {
            throw new IllegalStateException("알림 저장 결과에 생성된 번호가 없습니다.");
        }
        NotificationItemResponse response = toResponse(row);
        eventPublisher.publishEvent(new NotificationCreatedEvent(userId, response));
        return response;
    }

    // FP-300·D-23 저장 전에 알림 필수값과 내부 링크 형식·제어문자 미포함을 검증한다.
    private static void validate(long userId, String typeCode, String title, String content, String linkUrl) {
        if (userId <= 0 || typeCode == null || !TYPE_CODES.contains(typeCode)
                || title == null || title.isBlank() || title.length() > 200
                || content == null || content.isBlank() || content.length() > 1000
                || (linkUrl != null && (!linkUrl.startsWith("/") || linkUrl.startsWith("//")
                        || linkUrl.length() > 500 || linkUrl.indexOf('\\') >= 0 || linkUrl.contains("://") || linkUrl.chars().anyMatch(Character::isISOControl)))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "알림 입력값을 확인해 주세요.");
        }
    }

    private static NotificationItemResponse toResponse(NotificationRow row) {
        return new NotificationItemResponse(row.getNotificationId(), row.getTypeCode(), row.getTitle(),
                row.getContent(), row.getLinkUrl(), row.getReadAt() != null, row.getCreatedAt());
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "알림을 찾을 수 없습니다.");
    }
}