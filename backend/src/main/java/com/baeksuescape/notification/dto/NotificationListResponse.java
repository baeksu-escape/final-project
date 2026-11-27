package com.baeksuescape.notification.dto;

import java.util.List;

/** FP-284·D-23 최근 알림과 전체 안 읽은 개수를 묶어 반환한다. */
public record NotificationListResponse(long unreadCount, List<NotificationItemResponse> items) {
}