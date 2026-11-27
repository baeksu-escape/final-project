package com.baeksuescape.notification.dto;

import java.time.LocalDateTime;

/** FP-284·D-23 알림 목록 항목 응답이다. 읽음 여부와 내부 이동 경로를 포함한다. */
public record NotificationItemResponse(long notificationId, String typeCode, String title, String content,
        String linkUrl, boolean read, LocalDateTime createdAt) {
}