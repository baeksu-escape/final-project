package com.baeksuescape.notification.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

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
    private static final int LIST_LIMIT = 20;
    private static final Set<String> TYPE_CODES = Set.of("SCORE_NEW", "COMMENT_NEW", "REPORT_RESULT", "WELCOME");

    private final NotificationMapper notificationMapper;
    private final ApplicationEventPublisher eventPublisher;

    public NotificationService(NotificationMapper notificationMapper, ApplicationEventPublisher eventPublisher) {
        this.notificationMapper = notificationMapper;
        this.eventPublisher = eventPublisher;
    }

    /** FP-284·D-23 최근 20건과 회원의 안 읽은 개수를 조회한다. */
    @Transactional(readOnly = true)
    public NotificationListResponse list(long userId) {
        List<NotificationItemResponse> items = notificationMapper.selectLatest(userId, LIST_LIMIT).stream()
                .map(NotificationService::toResponse).toList();
        return new NotificationListResponse(notificationMapper.countUnread(userId), items);
    }

    /** FP-284·D-23 본인 알림만 읽음 처리하고, 이미 읽었거나 존재하지 않으면 404로 응답한다. */
    @Transactional
    public void markRead(long userId, long notificationId) {
        if (notificationMapper.markRead(userId, notificationId, LocalDateTime.now()) == 0
                && notificationMapper.selectOwned(userId, notificationId) == null) {
            throw notFound();
        }
    }

    /** FP-284·D-23 본인 안 읽은 알림을 모두 읽음 처리하고 변경 건수를 반환한다. */
    @Transactional
    public int markAllRead(long userId) {
        return notificationMapper.markAllRead(userId, LocalDateTime.now());
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
        row.setCreatedAt(LocalDateTime.now());
        notificationMapper.insert(row);
        if (row.getNotificationId() == null) {
            throw new IllegalStateException("알림 저장 결과에 생성된 번호가 없습니다.");
        }
        NotificationItemResponse response = toResponse(row);
        eventPublisher.publishEvent(new NotificationCreatedEvent(userId, response));
        return response;
    }

    private static void validate(long userId, String typeCode, String title, String content, String linkUrl) {
        if (userId <= 0 || typeCode == null || !TYPE_CODES.contains(typeCode)
                || title == null || title.isBlank() || title.length() > 200
                || content == null || content.isBlank() || content.length() > 1000
                || (linkUrl != null && (!linkUrl.startsWith("/") || linkUrl.startsWith("//")
                        || linkUrl.length() > 500 || linkUrl.indexOf('\\') >= 0 || linkUrl.contains("://")))) {
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