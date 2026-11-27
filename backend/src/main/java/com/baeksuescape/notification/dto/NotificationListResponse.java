package com.baeksuescape.notification.dto;

import java.util.List;

/** FP-300·D-23 알림 항목·전체 안 읽은 개수와 다음 페이지 유무를 묶어 반환한다. */
public record NotificationListResponse(long unreadCount, List<NotificationItemResponse> items, boolean hasMore) {
    public NotificationListResponse(long unreadCount, List<NotificationItemResponse> items) {
        this(unreadCount, items, false);
    }
}